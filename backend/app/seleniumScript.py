from enum import Enum
from selenium import webdriver
from selenium.webdriver.common.by import By
import actionSequence
import time

class SeleniumAction(Enum):
    CLICK = "click"
    NAVIGATE = "navigate" 
    ENTER_TEXT = "enter_text"
    WAIT = "wait"

class SelectorType(Enum):
    ID = "id"  
    NAME = "name"
    CLASS_NAME = "class"
    CSS_SELECTOR = "css_selector" 
    XPATH = "xpath"
    
    def to_by(self):
        selector_map = {
            self.ID: By.ID,
            self.NAME: By.NAME,
            self.CLASS_NAME: By.CLASS_NAME,
            self.CSS_SELECTOR: By.CSS_SELECTOR,
            self.XPATH: By.XPATH
        }
        return selector_map[self]

class SeleniumAgent:
    def __init__(self):
        self.driver = webdriver.Chrome()
        
    def follow_actions(self, json: actionSequence.ActionSequence):
        for step in json.steps:
            time.sleep(5)
            match step.action:
                case "navigate":
                    self.driver.get(step.url)
                    
                case "click":
                    typpe = step.selector_type.upper().strip().replace(" ", "_")
                    if typpe == "CSS":
                        typpe = "CSS_SELECTOR"
                    element = self.driver.find_element(
                        by=SelectorType[typpe].to_by(), 
                        value=step.selector
                    )
                    element.click()
                    
                case "enter_text":
                    typpe = step.selector_type.upper().strip().replace(" ", "_")
                    if typpe == "CSS":
                        typpe = "CSS_SELECTOR"
                    element = self.driver.find_element(
                        by=SelectorType[typpe].to_by(),
                        value=step.selector
                    )
                    element.send_keys(step.text)
                case "wait":
                    self.driver.implicitly_wait(step.duration)
                    
                case _:
                    raise ValueError(f"Invalid action {step.action}")
    
    def close(self):
        self.driver.quit()