import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Query
import os
import time

from fastapi.responses import JSONResponse
from openai import OpenAI
from actionSequence import ActionSequence
from pydantic import BaseModel
import httpx
from typing import Any, Dict, Optional
from fastapi.middleware.cors import CORSMiddleware
import actionPrompt
from loguru import logger
from browser_user.generate_agents_json import run_agent_and_process_history, run_agent_and_return_history
import uvicorn
import requests
from db import mongodb
import seleniumScript
import time
import json
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this for security (e.g., ["http://localhost:3000"])
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers
)
load_dotenv()  
#Dominos username - gigac3000@gmail.com
#Dominos pass -upVyjw.c4b#8pr
DEFAULT_PROMPT = "Use this website as a user of the website using the most common actions"

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/api/v1/query_agent")
async def query_agent(
    prompt: str = Query(..., description="The prompt for the agent"),
    url: str = Query(None, description="The base URL for the agent"),
    max_steps: int = Query(20, description="The maximum number of steps the agent should take")
):
    """
    API endpoint to run the agent and return its history.
    """
    logger.info(f"Received request to run agent on {url} with prompt: {prompt}")
    
    # Run agent and get history
    history_data = await run_agent_and_return_history(prompt, url, max_steps)
    final_result = next((result.extracted_content for result in history_data if result.is_done), None)
    logger.info(f"Final Result", final_result)

    if final_result:
        return JSONResponse(content={"result": final_result}, status_code=200)
    else:
        return JSONResponse(content={"error": "No result found"}, status_code=404)



@app.get("/initiate")
async def initiate(prompt: str, url: str, actions):
    # Validate payment address

    # Get agentsJSON if it exists
    agents_json = None
    agents_json = await get_agents_json_inner(url, prompt)

    if agents_json == None:
        with open('testAgents.json') as f:
            agents_json = json.load(f)
    logger.info(f"Found {agents_json}")

    # Call chat to get the actions.json based on the prompt and agentsJSON
    action_sequence = await generate_actions_inner(UserPrompt(prompt=prompt, agents_json=agents_json))

    # Run actions through selenium
    seleniumAgent = seleniumScript.SeleniumAgent()
    if not actions:
        with open('actions.json') as f:
            json_data = json.load(f)
            action_sequence = ActionSequence.from_json(json_data)
    action_sequence = ActionSequence.from_json(json_data)
    seleniumAgent.follow_actions(action_sequence)
    return {"message": "Hello World"}


@app.get("/get_json")
async def get_agents_json(
    url: str = Query(..., description="The input URL to check for agents.json"),
    prompt: str = Query(None, description="The prompt for agent generation")
):
    prompt = prompt or DEFAULT_PROMPT  
    logger.info(f"Get JSON Called with prompt: {prompt}")
    return await get_agents_json_inner(url, prompt)


async def get_agents_json_inner(
    url: str = Query(..., description="The input URL to check for agents.json"),
    prompt: str = Query(..., description="The prompt for agent generation")
):
    """
    Checks if an agents.json file exists at the input URL by performing a GET request.
    If found, returns its content.
    Otherwise, checks the database for an agents.json record.
    If still not found, generates a new agents.json using the provided URL and prompt,
    stores it in the database, and returns the configuration.
    """
    # Fallback prompt if user didn't supply one


    logger.info(f"Getting agents.json for {url} prompt: {prompt}")

    # Step 1: Attempt to retrieve agents.json from the input URL
    agents_url = url.rstrip("/") + "/agents.json"
    logger.info(f"Attempting to fetch remote agents.json from {agents_url}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(agents_url)
            if response.status_code == 200:
                # Check if server claims it's JSON
                content_type = response.headers.get("Content-Type", "")
                if "application/json" in content_type.lower():
                    # Attempt to parse the JSON
                    try:
                        data = response.json()
                        print(data)
                        # Optionally validate `data` structure before returning
                        # For example, you could check if it contains certain keys:
                        # if "agents" in data and isinstance(data["agents"], list):
                        #     return data
                        # else:
                        #     logger.info("JSON does not appear to be a valid agents.json structure.")
                        #     # Fall through to DB check
                        
                        logger.info(f"Found valid JSON at {agents_url}")
                        return data
                    except ValueError:
                        logger.info("Response was 200 but not valid JSON.")
                else:
                    logger.info(
                        f"Response from {agents_url} had status 200 "
                        f"but Content-Type was '{content_type}' not JSON."
                    )
            else:
                logger.info(
                    f"No valid agents.json at {agents_url}; "
                    f"HTTP status code {response.status_code}"
                )
    except Exception as e:
        # Catch network or other errors
        logger.info(f"Could not retrieve agents.json from {agents_url}: {e}")

    # Step 2: Check the database for agents.json
    # logger.info("Checking the database for existing agents.json config.")
    # db = mongodb.get_database("NYUDB")
    # collection = db["Sites"]

    # try:
    #     document = collection.find_one({"url": url})
    #     if document and "config" in document:
    #         logger.info("Found agents.json in database.")
    #         return document["config"]
    #     else:
    #         logger.info("No agents.json in database for this URL.")
    # except Exception as e:
    #     logger.exception(f"Error checking the database for config: {e}")

    logger.info(f"Generating a new agents.json using the provided prompt: {url}")
    try:
        final_config = await run_agent_and_process_history(base_url=url, prompt=prompt)
        document = {"url": url, "config": final_config}
        # collection.insert_one(document)
        logger.info(f"New agents.json generated and saved to database: {document} ",indent=2)
        return final_config
    except Exception as exc:
        logger.exception("Error during generation of agents.json.")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating agents.json: {exc}"
        )
class UserPrompt(BaseModel):
    prompt: str
    agents_json: Dict[str, Any]
    
@app.post("/generate_actions")
async def generate_actions(request: UserPrompt):
    """
    Generates actions.json from agents.json.
    This is a dummy function that transforms UI interactions into an action list.
    """
    actions =  await generate_actions_inner(request)
    print("actions ", actions)
    # # Convert the actions to a JSON string
    actions_json = json.dumps(actions)

    with open("actions.json") as f:
        actions_json = json.loads(f.read())
        logger.info(f'Trying to open actions.json {actions_json}')
        action_sequence = ActionSequence.from_json(actions_json)
    return actions_json

    
async def generate_actions_inner(request: UserPrompt):
    # Call chat to get the actions.json based on the prompt and agentsJSON
    system_prompt = actionPrompt.ACTION_PROMPT

    prompt = request.prompt
    AGENTS_JSON = request.agents_json
    print(request)
    openai_api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=openai_api_key)

    # use OpenAI agent to create a plan to carry out the user request and read the site agents.json, which includes instructions for how to navigate the site
    # Create a new thread with the user prompt
    thread = client.beta.threads.create(
        messages=[
            {
                "role": "user",
                "content": f"User query: {prompt}\n\nagents.json content:\n\n" + json.dumps(AGENTS_JSON, indent=4)
            }
        ]
    )

    thread_id = thread.id
    ASSISTANT_ID = "asst_DbhoCR3gQBaTumwL92yKp0JT"
    # Run the assistant with the provided assistant ID
    run = client.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id=ASSISTANT_ID
    )

    run_id = run.id

    # Poll for completion
    while True:
        run_status = client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run_id)
        if run_status.status == "completed":
            break
        elif run_status.status in ["failed", "cancelled"]:
            return {"error": f"Run failed with status: {run_status.status}"}
        time.sleep(2)  # Wait before checking again

    # Fetch the messages from the completed thread
    messages = client.beta.threads.messages.list(thread_id=thread_id)
    
    actions_response = messages.data[0].content[0].text.value

    # Save the generated actions JSON
    with open("actions.json", "w") as actions_file:
        actions_file.write(actions_response)

    print(actions_response)

    return actions_response

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)