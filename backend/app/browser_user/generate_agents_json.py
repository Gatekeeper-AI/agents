from __future__ import annotations
import asyncio
import json
import logging
import os
from pprint import pprint
from urllib.parse import urlparse, parse_qs

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from pydantic import BaseModel
from dotenv import load_dotenv

# (Import your agent, browser, and related modules as needed)
from browser_use.agent.service import Agent
from browser_use.browser.browser import Browser, BrowserConfig
from browser_use.browser.context import BrowserContext, BrowserContextConfig
from browser_use.agent.views import AgentHistoryList

load_dotenv()
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def get_domain(url: str) -> str:
    """Extract the domain (without the 'www.' prefix) from a URL."""
    domain = urlparse(url).netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain

def default_converter(o):
    """
    Default converter for objects not serializable by the default JSON encoder.
    If the object has a `to_dict()` method, it is used; otherwise, fallback to __dict__.
    """
    if hasattr(o, "to_dict"):
        return o.to_dict()
    elif hasattr(o, "__dict__"):
        return o.__dict__
    raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

def build_flows_from_agent_history(agent_history: AgentHistoryList) -> dict:
    """
    Build a raw flows tree from the agent's history.

    Each history item is assumed to have:
      - state: an object with properties such as `url` and `title`
      - model_output: an object that (if available) contains an `action` list.

    For each history item, a flow node is created with:
      - id, title, and url,
      - interactive_elements (from the state's selector_map),
      - actions (each action is extracted from the history; here, the selector details are set to placeholders),
      - transitions if the URL changed compared to the previous history item.

    Returns a dictionary that can be later refined via the LLM.
    """
    flows = []
    flow_counter = 0
    previous_flow = None

    for history_item in agent_history.history:
        # Skip history items with no valid state or URL.
        if not hasattr(history_item, "state") or not history_item.state.url:
            continue

        current_url = history_item.state.url
        current_title = history_item.state.title or ""
        flow_counter += 1
        flow_id = f"flow_{flow_counter}"
        flow_node = {
            "id": flow_id,
            "title": current_title,
            "url": current_url,
            "interactive_elements": getattr(history_item.state, "selector_map", {}),
            "actions": [],
            "transitions": []
        }

        # Extract raw actions from model_output if available.
        if (hasattr(history_item, "model_output") and history_item.model_output and
            hasattr(history_item.model_output, "action") and history_item.model_output.action):
            actions = []
            for idx, action in enumerate(history_item.model_output.action, start=1):
                # Convert action to dict.
                if isinstance(action, dict):
                    action_data = action
                elif isinstance(action, BaseModel):
                    try:
                        action_data = action.model_dump()
                    except Exception:
                        action_data = action.__dict__
                else:
                    try:
                        action_data = dict(action)
                    except Exception:
                        action_data = {}

                operation = action_data.get("recommended_action", "click_element")
                instructions = action_data.get("description", "Interact with element.")
                # Set placeholder values for selector-related fields.
                action_dict = {
                    "id": f"action_{idx}",
                    "operation": operation,
                    "selector": "<selector_placeholder>",
                    "selector_type": "<selector_type_placeholder>",
                    "instructions": instructions
                }
                if operation == "input_text":
                    action_dict["text"] = action_data.get("text", "example input")
                actions.append(action_dict)
            flow_node["actions"] = actions

        # Record a transition if the URL changed compared to the previous history item.
        if previous_flow and previous_flow["url"] != current_url:
            source_action_id = previous_flow["actions"][-1]["id"] if previous_flow["actions"] else None
            transition = {
                "trigger": "click",
                "sourceActionId": source_action_id,
                "targetFlowId": flow_id,
                "relationship": {
                    "full_url": current_url,
                    "path": urlparse(current_url).path,
                    "query_params": parse_qs(urlparse(current_url).query)
                }
            }
            previous_flow["transitions"].append(transition)

        flows.append(flow_node)
        previous_flow = flow_node

    agents_config = {
        "agentsJson": "1.0.0",
        "baseUrl": flows[0]["url"] if flows else "",
        "flows": flows
    }
    return agents_config

async def process_flow_context(llm, flow_node: dict, model_actions, model_thoughts):
    """
    Process each flow’s context to extract its important interactive elements.
    This function uses the LLM and passes the aggregated model actions and thoughts along with page context.
    The LLM should return valid JSON with a key "important_elements".
    The result is stored in flow_node["important_elements"].
    """
    prompt = (
        "You are an expert in web interaction and agent design. "
        "Given the following context, decide which interactive elements are most important for building an automated agent that uses selectors to interact with a page. "
        "Return ONLY valid JSON with a single key 'important_elements' containing an array of objects, where each object includes:\n"
        "  - name: a descriptive name of the element,\n"
        "  - tag: the HTML tag,\n"
        "  - selector: the best selector for the element,\n"
        "  - selector_type: the type of the selector (e.g., 'css_selector', 'xpath'),\n"
        "  - description: a short explanation why the element is important,\n"
        "  - recommended_action: e.g., 'click_element' or 'input_text'.\n\n"
        "Model Actions:\n" + json.dumps(model_actions, indent=2, default=default_converter) + "\n\n"
        "Model Thoughts:\n" + json.dumps(model_thoughts, indent=2, default=default_converter) + "\n\n"
        "Page context:\n" + json.dumps({
            "url": flow_node.get("url"),
            "title": flow_node.get("title"),
            "interactive_elements": flow_node.get("interactive_elements", {})
        }, indent=2) + "\n\n"
    )
    try:
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        content = response.content.replace("```json", "").replace("```", "")
        result = json.loads(content)
        flow_node["interactive_elements"] = result.get("important_elements", [])
        logger.info("Flow %s (%s) important elements: %s", flow_node.get("id"), flow_node.get("url"), flow_node["interactive_elements"])
    except Exception as e:
        logger.error("LLM processing error for flow %s: %s", flow_node.get("url"), e)
        flow_node["interactive_elements"] = []

async def process_outer_flows(llm, flows_config: dict, model_actions, model_thoughts) -> dict:
    """
    Offload the final, full outer processing of flows to the LLM.
    This function passes the aggregated model actions, model thoughts, and the current flows (with their actions, transitions, and important elements)
    to the LLM. The LLM should return a final, refined configuration (agents.json) with updated action selectors, selector types, and instructions.
    The returned JSON must include the keys: agentsJson, baseUrl, and flows.
    """
    prompt = (
        "You are an expert in web agent design and workflow analysis. Using the context provided, generate a final, refined JSON configuration "
        "for an automated agent. The final JSON must include the following keys: 'agentsJson', 'baseUrl', and 'flows'. Each flow should have:\n"
        "  - id, title, url, interactive_elements,\n"
        "  - actions: where each action includes id, operation, refined selector, selector_type, and instructions (and text if needed),\n"
        "  - transitions, and important_elements.\n\n"
        "In your output, update any placeholder values (e.g., \"<selector_placeholder>\", \"<selector_type_placeholder>\") with the best available data.\n\n"
        "Model Actions:\n" + json.dumps(model_actions, indent=2, default=default_converter) + "\n\n"
        "Model Thoughts:\n" + json.dumps(model_thoughts, indent=2, default=default_converter) + "\n\n"
        "Processed Flows:\n" + json.dumps(flows_config, indent=2, default=default_converter) + "\n\n"
        "Return ONLY valid JSON."
    )
    try:
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        content = response.content.replace("```json", "").replace("```", "")
        final_config = json.loads(content)
        logger.info("Final refined configuration generated by LLM.")
        return final_config
    except Exception as e:
        logger.error("LLM processing error for outer flows: %s", e)
        return flows_config

async def run_agent_and_process_history(base_url: str = "https://x.com", prompt: str = "Login to my twitter and click a post with my username: attack199850815 and password: Jack1234"):
    target_domain = get_domain(base_url)
    
    llm = ChatGroq(model="deepseek-r1-distill-qwen-32b", api_key=os.getenv("GROQ_API_KEY"))
    # Create an LLM instance.
    # llm = ChatGoogleGenerativeAI(model='gemini-2.0-flash-exp', api_key=os.getenv("GOOGLE_GENERATIVE_API_KEY"))
    
    # Create a Browser instance with your desired configuration.
    browser = Browser(config=BrowserConfig(headless=False, disable_security=True))
    
 # Create a BrowserContextConfig with the start_url.
    context_config = BrowserContextConfig(start_url=base_url)
    
    # Instantiate a BrowserContext.
    browser_context = BrowserContext(browser, config=context_config)
    
    
    # Initialize the Agent with a task (e.g., a login task).
    logger.info(f"Setting up agent prompt: {prompt} using LLM {llm.model_name}")
    agent = Agent(
        task=prompt,
        llm=llm,
        browser_context=browser_context,
    )
    
    max_steps = 20  # Adjust as needed.

    logger.info("Starting agent discovery loop...")
    history: AgentHistoryList = await agent.run(max_steps=max_steps)
    logger.info(f"Agent discovery completed in {agent.n_steps} steps.")

    # (Optional) Print aggregated model actions and thoughts for inspection.
    model_actions = history.model_actions()  # Assumed to return a list of model actions.
    model_thoughts = history.model_thoughts()  # Assumed to return a list of model thoughts.
    print('\nModel Outputs:')
    pprint(model_actions, indent=2)
    print('\nThoughts:')
    pprint(model_thoughts, indent=2)

    # Build the raw flows configuration from the agent's history.
    flows_config = build_flows_from_agent_history(history)
    
    # For each flow, process the page context using the LLM to extract important elements.
    for flow in flows_config["flows"]:
        await process_flow_context(llm, flow, model_actions, model_thoughts)
    
    # Offload the full outer processing (refining actions, selectors, and instructions) to the LLM.
    final_config = await process_outer_flows(llm, flows_config, model_actions, model_thoughts)
    
    # Save the final configuration to agents.json.
    with open("agents.json", "w") as f:
        json.dump(final_config, f, indent=2)
    logger.info("Saved final agents.json configuration.")
    pprint(final_config, indent=2)

    return final_config

async def run_agent_and_return_history(prompt: str, base_url: str = None, max_steps: int = 20):
    if base_url:
        target_domain = get_domain(base_url)

# Create a BrowserContextConfig with the start_url.    
    context_config = BrowserContextConfig(start_url=base_url)

    # Create a Browser instance with your desired configuration.
    browser = Browser(config=BrowserConfig(headless=False, disable_security=True))
    
    # Instantiate a BrowserContext.
    browser_context = BrowserContext(browser, config=context_config)
    
    # llm = ChatGroq(model="deepseek-r1-distill-qwen-32b", api_key=os.getenv("GROQ_API_KEY"))
    llm = ChatGoogleGenerativeAI(model='gemini-2.0-flash-exp', api_key=os.getenv("GOOGLE_GENERATIVE_API_KEY"))
    # Initialize the Agent with a task (e.g., a login task).
    logger.info(f"Setting up agent prompt: {prompt}")
    agent = Agent(
        task=prompt,
        llm=llm,
        browser_context=browser_context,
    )
    
    logger.info("Starting agent discovery loop...")
    history: AgentHistoryList = await agent.run(max_steps=max_steps)
    logger.info(f"Agent discovery completed in {agent.n_steps} steps.")
    logger.info(f'History: {history}')
    return history.action_results()

def generate_agents_json(base_url: str, prompt: str):
    asyncio.run(run_agent_and_process_history(base_url=base_url, prompt=prompt))

if __name__ == "__main__":
    base_url = "https://x.com"
    prompt = "Login to my twitter and click a post with my username: attack199850815 and password: Jack1234"
    generate_agents_json(base_url=base_url, prompt=prompt)