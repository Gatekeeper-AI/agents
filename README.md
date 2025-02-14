```mermaid
graph TD
    A[Website Owner] -->|Creates| B(agents.json)
    B -->|Defines| C{API & UI Interactions}
    B -->|Specifies| D[Solana Public Key]
    E[AI Agent] -->|Requests Access| F{Check agents.json}
    F -->|If exists| G{Verify Payment}
    G -->|Paid| H[Grant Access]
    G -->|Not Paid| I[Block Access]
    F -->|If not exists| J[Use Traditional Scraping]
    H -->|Interact via| K[Defined API]
    L[Frontend Tool] -->|Generates| B
    L -->|Sets up| M[Solana Payment Billing]
    N[Human User] -->|Uses| L
    L -->|Acts as| Ecurl
```


#README

Frontend:
Generate agents.json / interact with webpages



Backend:

Add agents.json to /agents.json our website reads the agents.json and uses that as a framework to interact with it. 
If not agents.json is found on a website, generate agent.json


Generate Agent.json:
Sign in with email and otp and then get solana address include that in the agent.json as well 

Either curl to get html 


Intereacting with agents.json:
tools:
click - 
type - 
navagate - 

