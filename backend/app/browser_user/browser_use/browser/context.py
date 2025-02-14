from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional, TypedDict

from playwright.async_api import Browser as PlaywrightBrowser
from playwright.async_api import BrowserContext as PlaywrightBrowserContext, Page

from browser_use.browser.views import BrowserError, BrowserState, TabInfo, URLNotAllowedError
from browser_use.dom.views import DOMElementNode
from browser_use.utils import time_execution_sync

logger = logging.getLogger(__name__)


# Extend the window size type as before.
class BrowserContextWindowSize(TypedDict):
    width: int
    height: int


@dataclass
class BrowserContextConfig:
    """
    Configuration for the BrowserContext.

    New parameter:
      start_url: Optional URL to navigate to immediately when a new page is created.
    """
    cookies_file: Optional[str] = None
    minimum_wait_page_load_time: float = 0.5
    wait_for_network_idle_page_load_time: float = 1.0
    maximum_wait_page_load_time: float = 5.0
    wait_between_actions: float = 1.0

    disable_security: bool = False

    browser_window_size: BrowserContextWindowSize = field(
        default_factory=lambda: {"width": 1280, "height": 1100}
    )
    no_viewport: Optional[bool] = None

    save_recording_path: Optional[str] = None
    save_downloads_path: Optional[str] = None
    trace_path: Optional[str] = None
    locale: Optional[str] = None
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36  (KHTML, like Gecko) "
        "Chrome/85.0.4183.102 Safari/537.36"
    )

    highlight_elements: bool = True
    viewport_expansion: int = 500
    allowed_domains: Optional[list[str]] = None
    include_dynamic_attributes: bool = True

    # NEW: start_url – if provided, the browser will immediately navigate to this URL
    start_url: Optional[str] = None


@dataclass
class BrowserSession:
    context: PlaywrightBrowserContext
    current_page: Page
    cached_state: BrowserState


class BrowserContext:
    def __init__(
        self,
        browser: "Browser",
        config: BrowserContextConfig = BrowserContextConfig(),
    ):
        self.context_id = str(uuid.uuid4())
        logger.debug(f"Initializing new browser context with id: {self.context_id}")
        self.config = config
        self.browser = browser
        self.session: Optional[BrowserSession] = None

    async def __aenter__(self):
        await self._initialize_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def _initialize_session(self) -> BrowserSession:
        logger.debug("Initializing browser context")
        playwright_browser = await self.browser.get_playwright_browser()
        context = await self._create_context(playwright_browser)
        self._add_new_page_listener(context)
        page = await context.new_page()
        # NEW: If a start URL is provided in the config, navigate to it.
        if self.config.start_url:
            logger.info(f"Navigating to start URL: {self.config.start_url}")
            await page.goto(self.config.start_url)
            await page.wait_for_load_state()
        else:
            logger.info("No start URL provided; remaining on default page.")
        initial_state = self._get_initial_state(page)
        self.session = BrowserSession(
            context=context, current_page=page, cached_state=initial_state
        )
        return self.session

    def _add_new_page_listener(self, context: PlaywrightBrowserContext):
        async def on_page(page: Page):
            await page.wait_for_load_state()
            logger.debug(f"New page opened: {page.url}")
            if self.session is not None:
                self.session.current_page = page

        context.on("page", on_page)

    async def get_session(self) -> BrowserSession:
        if self.session is None:
            return await self._initialize_session()
        return self.session

    async def get_current_page(self) -> Page:
        session = await self.get_session()
        return session.current_page

    async def _create_context(
        self, browser: PlaywrightBrowser
    ) -> PlaywrightBrowserContext:
        if self.browser.config.cdp_url and len(browser.contexts) > 0:
            context = browser.contexts[0]
        elif self.browser.config.chrome_instance_path and len(browser.contexts) > 0:
            context = browser.contexts[0]
        else:
            context = await browser.new_context(
                viewport=self.config.browser_window_size,
                no_viewport=False,
                user_agent=self.config.user_agent,
                java_script_enabled=True,
                bypass_csp=self.config.disable_security,
                ignore_https_errors=self.config.disable_security,
                record_video_dir=self.config.save_recording_path,
                record_video_size=self.config.browser_window_size,
                locale=self.config.locale,
            )
        if self.config.trace_path:
            await context.tracing.start(screenshots=True, snapshots=True, sources=True)
        if self.config.cookies_file and os.path.exists(self.config.cookies_file):
            with open(self.config.cookies_file, "r") as f:
                cookies = json.load(f)
                logger.info(
                    f"Loaded {len(cookies)} cookies from {self.config.cookies_file}"
                )
                await context.add_cookies(cookies)
        await context.add_init_script(
            """
            // Webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            // Languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US']
            });
            // Plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            // Chrome runtime
            window.chrome = { runtime: {} };
            // Permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            (function () {
                const originalAttachShadow = Element.prototype.attachShadow;
                Element.prototype.attachShadow = function attachShadow(options) {
                    return originalAttachShadow.call(this, { ...options, mode: "open" });
                };
            })();
            """
        )
        return context

    def _get_initial_state(self, page: Optional[Page] = None) -> BrowserState:
        return BrowserState(
            element_tree=DOMElementNode(
                tag_name="root",
                is_visible=True,
                parent=None,
                xpath="",
                attributes={},
                children=[],
            ),
            selector_map={},
            url=page.url if page else "",
            title="",
            screenshot=None,
            tabs=[],
        )

    async def _wait_for_stable_network(self):
        page = await self.get_current_page()
        pending_requests = set()
        last_activity = asyncio.get_event_loop().time()

        RELEVANT_RESOURCE_TYPES = {
            "document",
            "stylesheet",
            "image",
            "font",
            "script",
            "iframe",
        }
        RELEVANT_CONTENT_TYPES = {
            "text/html",
            "text/css",
            "application/javascript",
            "image/",
            "font/",
            "application/json",
        }
        IGNORED_URL_PATTERNS = {
            "analytics",
            "tracking",
            "telemetry",
            "beacon",
            "metrics",
            "doubleclick",
            "adsystem",
            "adserver",
            "advertising",
            "facebook.com/plugins",
            "platform.twitter",
            "linkedin.com/embed",
            "livechat",
            "zendesk",
            "intercom",
            "crisp.chat",
            "hotjar",
            "push-notifications",
            "onesignal",
            "pushwoosh",
            "heartbeat",
            "ping",
            "alive",
            "webrtc",
            "rtmp://",
            "wss://",
            "cloudfront.net",
            "fastly.net",
        }

        async def on_request(request):
            if request.resource_type not in RELEVANT_RESOURCE_TYPES:
                return
            if request.resource_type in {"websocket", "media", "eventsource", "manifest", "other"}:
                return
            url = request.url.lower()
            if any(pattern in url for pattern in IGNORED_URL_PATTERNS):
                return
            if url.startswith(("data:", "blob:")):
                return
            headers = request.headers
            if headers.get("purpose") == "prefetch" or headers.get("sec-fetch-dest") in ["video", "audio"]:
                return
            nonlocal last_activity
            pending_requests.add(request)
            last_activity = asyncio.get_event_loop().time()

        async def on_response(response):
            request = response.request
            if request not in pending_requests:
                return
            content_type = response.headers.get("content-type", "").lower()
            if any(t in content_type for t in ["streaming", "video", "audio", "webm", "mp4", "event-stream", "websocket", "protobuf"]):
                pending_requests.remove(request)
                return
            if not any(ct in content_type for ct in RELEVANT_CONTENT_TYPES):
                pending_requests.remove(request)
                return
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > 5 * 1024 * 1024:
                pending_requests.remove(request)
                return
            nonlocal last_activity
            pending_requests.remove(request)
            last_activity = asyncio.get_event_loop().time()

        page.on("request", on_request)
        page.on("response", on_response)
        try:
            start_time = asyncio.get_event_loop().time()
            while True:
                await asyncio.sleep(0.1)
                now = asyncio.get_event_loop().time()
                if len(pending_requests) == 0 and (now - last_activity) >= self.config.wait_for_network_idle_page_load_time:
                    break
                if now - start_time > self.config.maximum_wait_page_load_time:
                    logger.debug(
                        f"Network timeout after {self.config.maximum_wait_page_load_time}s with {len(pending_requests)} pending requests: {[r.url for r in pending_requests]}"
                    )
                    break
        finally:
            page.remove_listener("request", on_request)
            page.remove_listener("response", on_response)
        logger.debug(f"Network stabilized for {self.config.wait_for_network_idle_page_load_time} seconds")

    async def _wait_for_page_and_frames_load(self, timeout_overwrite: float | None = None):
        start_time = time.time()
        try:
            await self._wait_for_stable_network()
            page = await self.get_current_page()
            await self._check_and_handle_navigation(page)
        except URLNotAllowedError as e:
            raise e
        except Exception:
            logger.warning("Page load failed, continuing...")
            pass
        elapsed = time.time() - start_time
        remaining = max((timeout_overwrite or self.config.minimum_wait_page_load_time) - elapsed, 0)
        logger.debug(f"--Page loaded in {elapsed:.2f} seconds, waiting for additional {remaining:.2f} seconds")
        if remaining > 0:
            await asyncio.sleep(remaining)

    def _is_url_allowed(self, url: str) -> bool:
        if not self.config.allowed_domains:
            return True
        try:
            from urllib.parse import urlparse
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.lower()
            if ":" in domain:
                domain = domain.split(":")[0]
            return any(
                domain == allowed_domain.lower() or domain.endswith("." + allowed_domain.lower())
                for allowed_domain in self.config.allowed_domains
            )
        except Exception as e:
            logger.error(f"Error checking URL allowlist: {str(e)}")
            return False

    async def _check_and_handle_navigation(self, page: Page) -> None:
        if not self._is_url_allowed(page.url):
            logger.warning(f"Navigation to non-allowed URL detected: {page.url}")
            try:
                await self.go_back()
            except Exception as e:
                logger.error(f"Failed to go back after detecting non-allowed URL: {str(e)}")
            raise URLNotAllowedError(f"Navigation to non-allowed URL: {page.url}")

    async def navigate_to(self, url: str):
        if not self._is_url_allowed(url):
            raise BrowserError(f"Navigation to non-allowed URL: {url}")
        page = await self.get_current_page()
        await page.goto(url)
        await page.wait_for_load_state()

    async def refresh_page(self):
        page = await self.get_current_page()
        await page.reload()
        await page.wait_for_load_state()

    async def go_back(self):
        page = await self.get_current_page()
        try:
            await page.go_back(timeout=10, wait_until="domcontentloaded")
        except Exception as e:
            logger.debug(f"During go_back: {e}")

    async def go_forward(self):
        page = await self.get_current_page()
        try:
            await page.go_forward(timeout=10, wait_until="domcontentloaded")
        except Exception as e:
            logger.debug(f"During go_forward: {e}")

    async def close_current_tab(self):
        session = await self.get_session()
        page = session.current_page
        await page.close()
        if session.context.pages:
            await self.switch_to_tab(0)

    async def get_page_html(self) -> str:
        page = await self.get_current_page()
        return await page.content()

    async def execute_javascript(self, script: str):
        page = await self.get_current_page()
        return await page.evaluate(script)

    @time_execution_sync("--get_state")
    async def get_state(self) -> BrowserState:
        await self._wait_for_page_and_frames_load()
        session = await self.get_session()
        session.cached_state = await self._update_state()
        if self.config.cookies_file:
            asyncio.create_task(self.save_cookies())
        return session.cached_state

    async def _update_state(self, focus_element: int = -1) -> BrowserState:
        session = await self.get_session()
        try:
            page = await self.get_current_page()
            await page.evaluate("1")
        except Exception as e:
            logger.debug(f"Current page is no longer accessible: {str(e)}")
            pages = session.context.pages
            if pages:
                session.current_page = pages[-1]
                page = session.current_page
                logger.debug(f"Switched to page: {await page.title()}")
            else:
                raise BrowserError("Browser closed: no valid pages available")
        try:
            await self.remove_highlights()
            from browser_use.dom.service import DomService
            dom_service = DomService(page)
            content = await dom_service.get_clickable_elements(
                focus_element=focus_element,
                viewport_expansion=self.config.viewport_expansion,
                highlight_elements=self.config.highlight_elements,
            )
            screenshot_b64 = await self.take_screenshot()
            pixels_above, pixels_below = await self.get_scroll_info(page)
            self.current_state = BrowserState(
                element_tree=content.element_tree,
                selector_map=content.selector_map,
                url=page.url,
                title=await page.title(),
                tabs=await self.get_tabs_info(),
                screenshot=screenshot_b64,
                pixels_above=pixels_above,
                pixels_below=pixels_below,
            )
            return self.current_state
        except Exception as e:
            logger.error(f"Failed to update state: {str(e)}")
            if hasattr(self, "current_state"):
                return self.current_state
            raise

    async def take_screenshot(self, full_page: bool = False) -> str:
        page = await self.get_current_page()
        screenshot = await page.screenshot(
            full_page=full_page,
            animations="disabled",
        )
        screenshot_b64 = base64.b64encode(screenshot).decode("utf-8")
        return screenshot_b64

    async def remove_highlights(self):
        try:
            page = await self.get_current_page()
            await page.evaluate(
                """
                try {
                    const container = document.getElementById("playwright-highlight-container");
                    if (container) {
                        container.remove();
                    }
                    const highlightedElements = document.querySelectorAll('[browser-user-highlight-id^="playwright-highlight-"]');
                    highlightedElements.forEach(el => {
                        el.removeAttribute("browser-user-highlight-id");
                    });
                } catch (e) {
                    console.error("Failed to remove highlights:", e);
                }
                """
            )
        except Exception as e:
            logger.debug(f"Failed to remove highlights (this is usually ok): {str(e)}")
            pass

    @classmethod
    def _convert_simple_xpath_to_css_selector(cls, xpath: str) -> str:
        if not xpath:
            return ""
        xpath = xpath.lstrip("/")
        parts = xpath.split("/")
        css_parts = []
        for part in parts:
            if not part:
                continue
            if "[" in part:
                base_part = part[: part.find("[")]
                index_part = part[part.find("[") :]
                indices = [i.strip("[]") for i in index_part.split("]")[:-1]]
                for idx in indices:
                    try:
                        if idx.isdigit():
                            index = int(idx) - 1
                            base_part += f":nth-of-type({index + 1})"
                        elif idx == "last()":
                            base_part += ":last-of-type"
                        elif "position()" in idx:
                            if ">1" in idx:
                                base_part += ":nth-of-type(n+2)"
                    except ValueError:
                        continue
                css_parts.append(base_part)
            else:
                css_parts.append(part)
        base_selector = " > ".join(css_parts)
        return base_selector

    @classmethod
    def _enhanced_css_selector_for_element(cls, element: DOMElementNode, include_dynamic_attributes: bool = True) -> str:
        try:
            css_selector = cls._convert_simple_xpath_to_css_selector(element.xpath)
            if "class" in element.attributes and element.attributes["class"] and include_dynamic_attributes:
                valid_class_name_pattern = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_-]*$")
                classes = element.attributes["class"].split()
                for class_name in classes:
                    if not class_name.strip():
                        continue
                    if valid_class_name_pattern.match(class_name):
                        css_selector += f".{class_name}"
                    else:
                        continue
            SAFE_ATTRIBUTES = {
                "id",
                "name",
                "type",
                "placeholder",
                "aria-label",
                "aria-labelledby",
                "aria-describedby",
                "role",
                "for",
                "autocomplete",
                "required",
                "readonly",
                "alt",
                "title",
                "src",
                "href",
                "target",
            }
            if include_dynamic_attributes:
                dynamic_attributes = {"data-id", "data-qa", "data-cy", "data-testid"}
                SAFE_ATTRIBUTES.update(dynamic_attributes)
            for attribute, value in element.attributes.items():
                if attribute == "class":
                    continue
                if not attribute.strip():
                    continue
                if attribute not in SAFE_ATTRIBUTES:
                    continue
                safe_attribute = attribute.replace(":", r"\:")
                if value == "":
                    css_selector += f"[{safe_attribute}]"
                elif any(char in value for char in '"\'<>`\n\r\t'):
                    collapsed_value = re.sub(r"\s+", " ", value).strip()
                    safe_value = collapsed_value.replace('"', '\\"')
                    css_selector += f'[{safe_attribute}*="{safe_value}"]'
                else:
                    css_selector += f'[{safe_attribute}="{value}"]'
            return css_selector
        except Exception:
            tag_name = element.tag_name or "*"
            return f"{tag_name}[highlight_index='{element.highlight_index}']"

    async def get_locate_element(self, element: DOMElementNode) -> Optional[ElementHandle]:
        current_frame = await self.get_current_page()
        parents: list[DOMElementNode] = []
        current = element
        while current.parent is not None:
            parents.append(current.parent)
            current = current.parent
        parents.reverse()
        iframes = [item for item in parents if item.tag_name == "iframe"]
        for parent in iframes:
            css_selector = self._enhanced_css_selector_for_element(
                parent, include_dynamic_attributes=self.config.include_dynamic_attributes
            )
            current_frame = current_frame.frame_locator(css_selector)
        css_selector = self._enhanced_css_selector_for_element(
            element, include_dynamic_attributes=self.config.include_dynamic_attributes
        )
        try:
            if hasattr(current_frame, "locator"):
                element_handle = await current_frame.locator(css_selector).element_handle()
                return element_handle
            else:
                element_handle = await current_frame.query_selector(css_selector)
                if element_handle:
                    await element_handle.scroll_into_view_if_needed()
                    return element_handle
                return None
        except Exception as e:
            logger.error(f"Failed to locate element: {str(e)}")
            return None

    async def _input_text_element_node(self, element_node: DOMElementNode, text: str):
        try:
            if element_node.highlight_index is not None:
                await self._update_state(focus_element=element_node.highlight_index)
            page = await self.get_current_page()
            element_handle = await self.get_locate_element(element_node)
            if element_handle is None:
                raise Exception(f"Element: {repr(element_node)} not found")
            await element_handle.scroll_into_view_if_needed(timeout=2500)
            await element_handle.fill("")
            await element_handle.type(text)
            await page.wait_for_load_state()
        except Exception as e:
            raise Exception(f"Failed to input text into element: {repr(element_node)}. Error: {str(e)}")

    async def _click_element_node(self, element_node: DOMElementNode) -> Optional[str]:
        page = await self.get_current_page()
        try:
            if element_node.highlight_index is not None:
                await self._update_state(focus_element=element_node.highlight_index)
            element_handle = await self.get_locate_element(element_node)
            if element_handle is None:
                raise Exception(f"Element: {repr(element_node)} not found")
            async def perform_click(click_func):
                if self.config.save_downloads_path:
                    try:
                        async with page.expect_download(timeout=5000) as download_info:
                            await click_func()
                        download = await download_info.value
                        download_path = os.path.join(self.config.save_downloads_path, download.suggested_filename)
                        await download.save_as(download_path)
                        logger.debug(f"Download triggered. Saved file to: {download_path}")
                        return download_path
                    except TimeoutError:
                        logger.debug("No download triggered within timeout. Checking navigation...")
                        await page.wait_for_load_state()
                        await self._check_and_handle_navigation(page)
                else:
                    await click_func()
                    await page.wait_for_load_state()
                    await self._check_and_handle_navigation(page)
            try:
                return await perform_click(lambda: element_handle.click(timeout=1500))
            except URLNotAllowedError as e:
                raise e
            except Exception:
                try:
                    return await perform_click(lambda: page.evaluate("(el) => el.click()", element_handle))
                except URLNotAllowedError as e:
                    raise e
                except Exception as e:
                    raise Exception(f"Failed to click element: {str(e)}")
        except URLNotAllowedError as e:
            raise e
        except Exception as e:
            raise Exception(f"Failed to click element: {repr(element_node)}. Error: {str(e)}")

    async def get_tabs_info(self) -> list[TabInfo]:
        session = await self.get_session()
        tabs_info = []
        for page_id, page in enumerate(session.context.pages):
            tab_info = TabInfo(page_id=page_id, url=page.url, title=await page.title())
            tabs_info.append(tab_info)
        return tabs_info

    async def switch_to_tab(self, page_id: int) -> None:
        session = await self.get_session()
        pages = session.context.pages
        if page_id >= len(pages):
            raise BrowserError(f"No tab found with page_id: {page_id}")
        page = pages[page_id]
        if not self._is_url_allowed(page.url):
            raise BrowserError(f"Cannot switch to tab with non-allowed URL: {page.url}")
        session.current_page = page
        await page.bring_to_front()
        await page.wait_for_load_state()

    async def create_new_tab(self, url: Optional[str] = None) -> None:
        if url and not self._is_url_allowed(url):
            raise BrowserError(f"Cannot create new tab with non-allowed URL: {url}")
        session = await self.get_session()
        new_page = await session.context.new_page()
        session.current_page = new_page
        await new_page.wait_for_load_state()
        page = await self.get_current_page()
        if url:
            await page.goto(url)
            await self._wait_for_page_and_frames_load(timeout_overwrite=1)

    async def get_selector_map(self) -> dict:
        session = await self.get_session()
        return session.cached_state.selector_map

    async def get_element_by_index(self, index: int) -> Optional[ElementHandle]:
        selector_map = await self.get_selector_map()
        element_handle = await self.get_locate_element(selector_map[index])
        return element_handle

    async def get_dom_element_by_index(self, index: int) -> DOMElementNode:
        selector_map = await self.get_selector_map()
        return selector_map[index]

    async def save_cookies(self):
        if self.session and self.session.context and self.config.cookies_file:
            try:
                cookies = await self.session.context.cookies()
                logger.info(f"Saving {len(cookies)} cookies to {self.config.cookies_file}")
                dirname = os.path.dirname(self.config.cookies_file)
                if dirname:
                    os.makedirs(dirname, exist_ok=True)
                with open(self.config.cookies_file, "w") as f:
                    json.dump(cookies, f)
            except Exception as e:
                logger.warning(f"Failed to save cookies: {str(e)}")

    async def is_file_uploader(self, element_node: DOMElementNode, max_depth: int = 3, current_depth: int = 0) -> bool:
        if current_depth > max_depth:
            return False
        is_uploader = False
        if not isinstance(element_node, DOMElementNode):
            return False
        if element_node.tag_name == "input":
            is_uploader = element_node.attributes.get("type") == "file" or element_node.attributes.get("accept") is not None
        if is_uploader:
            return True
        if element_node.children and current_depth < max_depth:
            for child in element_node.children:
                if isinstance(child, DOMElementNode):
                    if await self.is_file_uploader(child, max_depth, current_depth + 1):
                        return True
        return False

    async def get_scroll_info(self, page: Page) -> tuple[int, int]:
        scroll_y = await page.evaluate("window.scrollY")
        viewport_height = await page.evaluate("window.innerHeight")
        total_height = await page.evaluate("document.documentElement.scrollHeight")
        pixels_above = scroll_y
        pixels_below = total_height - (scroll_y + viewport_height)
        return pixels_above, pixels_below

    async def reset_context(self):
        session = await self.get_session()
        pages = session.context.pages
        for page in pages:
            await page.close()
        session.cached_state = self._get_initial_state()
        session.current_page = await session.context.new_page()

    def _get_initial_state(self, page: Optional[Page] = None) -> BrowserState:
        return BrowserState(
            element_tree=DOMElementNode(
                tag_name="root",
                is_visible=True,
                parent=None,
                xpath="",
                attributes={},
                children=[],
            ),
            selector_map={},
            url=page.url if page else "",
            title="",
            screenshot=None,
            tabs=[],
        )
