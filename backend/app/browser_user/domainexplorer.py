import json
import logging
import time
import os
from urllib.parse import urljoin, urlparse, parse_qs

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import (
    StaleElementReferenceException,
    WebDriverException,
    NoSuchElementException,
)
from langchain_openai import ChatOpenAI

# For asynchronous LLM calls.
import asyncio
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def get_domain(url: str) -> str:
    """Extract domain (without 'www.') from a URL."""
    domain = urlparse(url).netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


class DomainSiteExplorer:
    def __init__(self, base_url: str, max_depth: int = 3, driver_path: str = None, llm=None):
        """
        :param base_url: Starting URL for exploration.
        :param max_depth: Maximum recursion depth.
        :param driver_path: Optional path to the ChromeDriver executable.
        :param llm: An LLM instance with an async 'ainvoke' method.
        """
        self.base_url = base_url
        self.max_depth = max_depth
        self.visited = set()  # To avoid re-visiting URLs.
        self.site_structure = {}  # Maps URL -> page data.
        self.llm = llm  # LLM for processing page context.
        self.target_domain = get_domain(base_url)
        self.flow_counter = 0  # Counter to generate unique flow IDs

        # Set up a headless Chrome driver.
        options = webdriver.ChromeOptions()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        if driver_path:
            self.driver = webdriver.Chrome(executable_path=driver_path, options=options)
        else:
            self.driver = webdriver.Chrome(options=options)

    def get_xpath(self, element) -> str:
        """
        Compute an absolute XPath for the given element.
        """
        script = """
        function absoluteXPath(element) {
            var comp, comps = [];
            var xpath = '';
            var getPos = function(element) {
                var position = 1, sibling;
                if (element.nodeType == Node.ATTRIBUTE_NODE) {
                    return null;
                }
                for(sibling = element.previousSibling; sibling; sibling = sibling.previousSibling){
                    if(sibling.nodeName == element.nodeName)
                        ++position;
                }
                return position;
            }
            
            if (element instanceof Document) {
                return '/';
            }
            
            for (; element && !(element instanceof Document); element = element.parentNode) {
                comp = {};
                if (element.nodeType === Node.ELEMENT_NODE) {
                    comp.name = element.nodeName.toLowerCase();
                    comp.position = getPos(element);
                    comps.push(comp);
                }
            }
            
            for (var i = comps.length - 1; i >= 0; i--) {
                comp = comps[i];
                xpath += '/' + comp.name;
                if (comp.position !== null && comp.position > 1) {
                    xpath += '[' + comp.position + ']';
                }
            }
            
            return xpath;
        }
        return absoluteXPath(arguments[0]);
        """
        try:
            xpath = self.driver.execute_script(script, element)
            return xpath
        except WebDriverException as e:
            logger.error("Error computing xpath: %s", e)
            return ""

    def extract_interactive_elements(self) -> list:
        """
        Extract interactive elements from the current page.
        Returns a list of dictionaries.
        """
        elements = []
        try:
            candidates = self.driver.find_elements(
                By.XPATH, "//a | //button | //input | //textarea | //*[@onclick]"
            )
            for elem in candidates:
                try:
                    tag = elem.tag_name.lower()
                    # For non-input/textarea elements, skip if not displayed.
                    if tag not in ["input", "textarea"] and not elem.is_displayed():
                        continue

                    if tag in ["input", "textarea"]:
                        # Skip hidden input elements.
                        if tag == "input":
                            input_type = elem.get_attribute("type")
                            if input_type and input_type.lower() == "hidden":
                                continue
                        text = (elem.get_attribute("placeholder") or
                                elem.get_attribute("value") or
                                elem.get_attribute("name") or
                                ("Text Input" if tag == "input" else "Text Area"))
                    else:
                        text = elem.text.strip()

                    xpath = self.get_xpath(elem)
                    element_data = {
                        "name": text if text else tag,
                        "tag": tag,
                        "xpath": xpath,
                        "attributes": {
                            "type": elem.get_attribute("type") if tag == "input" else None
                        },
                    }
                    elements.append(element_data)
                except StaleElementReferenceException:
                    continue
        except Exception as e:
            logger.error("Error extracting interactive elements: %s", e)
        logger.info("Extracted elements: %s", elements)
        return elements

    def decode_url_relationship(self, current_url: str, new_url: str) -> dict:
        """
        Decode the new URL relative to current_url.
        """
        parsed = urlparse(new_url)
        params = parse_qs(parsed.query)
        return {
            "full_url": new_url,
            "path": parsed.path,
            "query_params": params,
        }

    def explore_page(self, url: str, depth: int = 0):
        """
        Recursively explore pages starting from a URL.
        Only follow links within the target domain.
        """
        if depth > self.max_depth:
            return
        if url in self.visited:
            # Return the already-explored page data.
            return self.site_structure.get(url)

        self.flow_counter += 1  # Increment flow counter for unique ID
        flow_id = f"flow_{self.flow_counter}"  # Generate unique flow ID

        logger.info("Exploring URL: %s at depth %d, Flow ID: %s", url, depth, flow_id)
        self.visited.add(url)
        page_data = {
            "id": flow_id,  # Assign the generated flow ID to page_data
            "url": url,
            "title": "",
            "interactive_elements": [],
            "transitions": [],
            "important_elements": []  # To be filled by the LLM.
        }

        try:
            self.driver.get(url)
            time.sleep(2)  # Wait for the page to load.
        except Exception as e:
            logger.error("Error loading %s: %s", url, e)
            return

        page_data["title"] = self.driver.title
        page_data["interactive_elements"] = self.extract_interactive_elements()
        # Use the current (possibly redirected) URL as the key.
        current_url = self.driver.current_url
        self.site_structure[current_url] = page_data

        # Process each interactive element to follow navigation.
        for element in page_data["interactive_elements"]:
            new_url = None
            tag = element.get("tag", "")
            try:
                elem = self.driver.find_element(By.XPATH, element["xpath"])
            except NoSuchElementException:
                continue

            if tag == "a":
                href = elem.get_attribute("href")
                if href:
                    new_url = urljoin(current_url, href)
            else:
                try:
                    original_url = self.driver.current_url
                    elem.click()
                    time.sleep(2)
                    new_url = self.driver.current_url
                    if new_url != original_url:
                        self.driver.back()  # Remain on the current page for further exploration.
                        time.sleep(2)
                except Exception as e:
                    logger.error("Error clicking element %s: %s", element["xpath"], e)

            # Check that new_url is within the target domain and is not the current URL.
            if new_url and new_url != current_url:
                if get_domain(new_url) != self.target_domain:
                    logger.info("Skipping external URL: %s", new_url)
                    continue

                # Explore the new page recursively to obtain its flow ID.
                next_page_data = self.explore_page(new_url, depth + 1)
                target_flow_id = next_page_data["id"] if next_page_data else None

                relationship = self.decode_url_relationship(current_url, new_url)
                transition = {
                    "trigger": "click",
                    "element": element,
                    "target_flow_id": target_flow_id,  # Use flow ID to reference the target page.
                    "relationship": relationship,
                }
                page_data["transitions"].append(transition)

        return page_data  # Return page_data so that the flow ID can be accessed in the calling function.

    async def process_page_context(self, page_data: dict):
        """
        Use the LLM to decide which elements are important for agent design.
        """
        prompt = (
            "You are an expert in web interaction and agent design. "
            "Given the following page context, decide which interactive elements are most important "
            "for building an automated agent. Return a JSON object with a single key 'important_elements' "
            "whose value is an array of objects. Each object should include:\n"
            "  - name: a descriptive name of the element,\n"
            "  - tag: the HTML tag,\n"
            "  - xpath: the element's XPath selector,\n"
            "  - description: a short description of why this element is important,\n"
            "  - recommended_action: e.g. 'click' or 'input_text'.\n\n"
            "Page context:\n"
            f"{json.dumps({'url': page_data.get('url'), 'title': page_data.get('title'), 'interactive_elements': page_data.get('interactive_elements')}, indent=2)}\n\n"
            "Return ONLY valid JSON."
        )
        try:
            response = await self.llm.ainvoke([{"role": "user", "content": prompt}])
            ai_content = response.content.replace("```json", "").replace("```", "")
            result = json.loads(ai_content)
            important_elements = result.get("important_elements", [])
            page_data["important_elements"] = important_elements
            logger.info("For page %s, important elements: %s", page_data.get("url"), important_elements)
        except Exception as e:
            logger.error("LLM processing error for page %s: %s", page_data.get("url"), e)
            page_data["important_elements"] = []

    def close(self):
        self.driver.quit()

    def build_agents_json(self) -> dict:
        """
        Build an agents.json configuration using the processed site structure.
        Each flow (page) includes actions (from the LLM's important_elements).
        If an action's XPath matches a transition discovered during exploration,
        that action will be assigned a "targetFlowId" indicating the destination flow.
        The final JSON will then have transitions embedded in actions,
        and the top-level "transitions" arrays in flows will be empty.
        """
        flows = []
        for url, page in self.site_structure.items():
            flow = {
                "id": page["id"],  # Use the flow_id from page_data.
                "title": page.get("title", ""),
                "url": url,
                "actions": [],
                "transitions": []  # Remains empty (transitions are attached to actions below)
            }
            actions = []
            # Build actions from LLM-determined important elements.
            for idx, element in enumerate(page.get("important_elements", []), start=1):
                action = {
                    "id": f"action_{idx}",
                    "operation": element.get("recommended_action", "click_element"),
                    "xpath": element.get("xpath"),
                    "instructions": element.get("description", f"Interact with {element.get('name', 'element')}.")
                }
                if element.get("recommended_action") == "input_text":
                    action["text"] = "example input"
                actions.append(action)
            
            # For each transition recorded during exploration, attach the destination (targetFlowId)
            # to the corresponding action (matched via the XPath).
            for transition in page.get("transitions", []):
                trans_xpath = transition["element"].get("xpath")
                for action in actions:
                    if action["xpath"] == trans_xpath:
                        # If a match is found, assign the targetFlowId to that action.
                        action["targetFlowId"] = transition.get("target_flow_id")
                        break
            
            flow["actions"] = actions
            flows.append(flow)
            
        agents_config = {
            "agentsJson": "1.0.0",
            "baseUrl": self.base_url,
            "flows": flows,
        }
        return agents_config



# =============================================================================
# Example usage
# =============================================================================

async def main():
    # Replace with your target site's URL.
    BASE_URL = "https://google.com"
    load_dotenv()

    # Create an LLM instance (example using LangChain's ChatOpenAI).
    llm = ChatOpenAI(model="gpt-4o")
    explorer = DomainSiteExplorer(BASE_URL, max_depth=3, llm=llm)
    try:
        # Start recursive exploration from the base URL.
        explorer.explore_page(BASE_URL)

        # Process each discovered page with the LLM.
        for url, page_data in explorer.site_structure.items():
            await explorer.process_page_context(page_data)

        # Build the final agents.json configuration.
        agents_config = explorer.build_agents_json()
        with open("agents.json", "w") as f:
            json.dump(agents_config, f, indent=2)
        logger.info("Saved agents.json configuration.")
    finally:
        explorer.close()


if __name__ == "__main__":
    asyncio.run(main())
