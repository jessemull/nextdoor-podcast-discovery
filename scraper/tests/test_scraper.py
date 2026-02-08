"""Tests for scraper module."""

from unittest import mock

import pytest
from playwright.sync_api import Browser, BrowserContext, Page, Playwright
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

from src.config import FEED_URLS, LOGIN_URL, NEWS_FEED_URL, SELECTORS
from src.exceptions import CaptchaRequiredError, LoginFailedError
from src.scraper import NextdoorScraper


class TestNextdoorScraper:
    """Test NextdoorScraper class."""

    @pytest.fixture
    def mock_playwright(self) -> mock.MagicMock:
        """Provide a mocked Playwright instance."""
        playwright = mock.MagicMock(spec=Playwright)
        browser = mock.MagicMock(spec=Browser)
        context = mock.MagicMock(spec=BrowserContext)
        page = mock.MagicMock(spec=Page)

        playwright.chromium.launch.return_value = browser
        browser.new_context.return_value = context
        context.new_page.return_value = page

        return playwright

    @pytest.fixture
    def scraper(self) -> NextdoorScraper:
        """Create a NextdoorScraper instance."""
        return NextdoorScraper(headless=True)

    def test_start_initializes_browser(self, scraper: NextdoorScraper) -> None:
        """Should initialize browser, context, and page on start."""
        with mock.patch("src.scraper.sync_playwright") as mock_sync:
            mock_playwright = mock.MagicMock()
            mock_browser = mock.MagicMock()
            mock_context = mock.MagicMock()
            mock_page = mock.MagicMock()

            mock_sync.return_value.start.return_value = mock_playwright
            mock_playwright.chromium.launch.return_value = mock_browser
            mock_browser.new_context.return_value = mock_context
            mock_context.new_page.return_value = mock_page

            scraper.start()

            assert scraper.browser is not None
            assert scraper.context is not None
            assert scraper.page is not None
            mock_playwright.chromium.launch.assert_called_once_with(headless=True)

    def test_stop_cleans_up_resources(self, scraper: NextdoorScraper) -> None:
        """Should clean up browser, context, and playwright on stop."""
        # Set up mock resources
        scraper._playwright = mock.MagicMock()
        scraper.browser = mock.MagicMock()
        scraper.context = mock.MagicMock()
        scraper.page = mock.MagicMock()

        scraper.stop()

        assert scraper.browser is None
        assert scraper.context is None
        assert scraper.page is None
        assert scraper._playwright is None
        scraper.context.close.assert_called_once()
        scraper.browser.close.assert_called_once()
        scraper._playwright.stop.assert_called_once()

    def test_context_manager_enters_and_exits(self) -> None:
        """Should work as a context manager."""
        with mock.patch("src.scraper.sync_playwright") as mock_sync:
            mock_playwright = mock.MagicMock()
            mock_browser = mock.MagicMock()
            mock_context = mock.MagicMock()
            mock_page = mock.MagicMock()

            mock_sync.return_value.start.return_value = mock_playwright
            mock_playwright.chromium.launch.return_value = mock_browser
            mock_browser.new_context.return_value = mock_context
            mock_context.new_page.return_value = mock_page

            with NextdoorScraper() as scraper:
                assert scraper.browser is not None

            # Should clean up on exit
            mock_context.close.assert_called_once()
            mock_browser.close.assert_called_once()
            mock_playwright.stop.assert_called_once()

    def test_login_success(self, scraper: NextdoorScraper) -> None:
        """Should successfully log in with valid credentials."""
        scraper.page = mock.MagicMock()
        scraper.page.url = NEWS_FEED_URL
        scraper.page.goto.return_value = None
        scraper.page.wait_for_selector.return_value = None
        scraper.page.locator.return_value.click.return_value = None
        scraper.page.locator.return_value.count.return_value = 0  # No CAPTCHA
        scraper.page.wait_for_url.return_value = None

        with mock.patch.dict("os.environ", {"NEXTDOOR_EMAIL": "test@example.com", "NEXTDOOR_PASSWORD": "password"}):
            scraper.login()

        scraper.page.goto.assert_called_once_with(LOGIN_URL)
        scraper.page.wait_for_selector.assert_called_once()

    def test_login_detects_captcha(self, scraper: NextdoorScraper) -> None:
        """Should raise CaptchaRequiredError when CAPTCHA is detected."""
        scraper.page = mock.MagicMock()
        scraper.page.goto.return_value = None
        scraper.page.wait_for_selector.return_value = None

        # Mock CAPTCHA detection
        captcha_locator = mock.MagicMock()
        captcha_locator.count.return_value = 1  # CAPTCHA found
        scraper.page.locator.side_effect = lambda sel: captcha_locator if sel in SELECTORS["captcha_indicators"] else mock.MagicMock()

        with mock.patch.dict("os.environ", {"NEXTDOOR_EMAIL": "test@example.com", "NEXTDOOR_PASSWORD": "password"}):
            with pytest.raises(CaptchaRequiredError):
                scraper.login()

    def test_login_fails_with_missing_credentials(self, scraper: NextdoorScraper) -> None:
        """Should raise LoginFailedError when credentials are missing."""
        scraper.page = mock.MagicMock()

        with mock.patch.dict("os.environ", {}, clear=True):
            with pytest.raises(LoginFailedError, match="NEXTDOOR_EMAIL and NEXTDOOR_PASSWORD required"):
                scraper.login()

    def test_login_fails_with_timeout(self, scraper: NextdoorScraper) -> None:
        """Should raise LoginFailedError when login times out."""
        scraper.page = mock.MagicMock()
        scraper.page.goto.return_value = None
        scraper.page.wait_for_selector.return_value = None
        scraper.page.locator.return_value.count.return_value = 0  # No CAPTCHA
        scraper.page.wait_for_url.side_effect = PlaywrightTimeoutError("Timeout")

        with mock.patch.dict("os.environ", {"NEXTDOOR_EMAIL": "test@example.com", "NEXTDOOR_PASSWORD": "password"}):
            with pytest.raises(LoginFailedError):
                scraper.login()

    def test_load_cookies(self, scraper: NextdoorScraper) -> None:
        """Should load cookies into browser context."""
        scraper.context = mock.MagicMock()
        cookies = [{"name": "test", "value": "cookie"}]

        scraper.load_cookies(cookies)

        scraper.context.add_cookies.assert_called_once()

    def test_get_cookies(self, scraper: NextdoorScraper) -> None:
        """Should get cookies from browser context."""
        scraper.context = mock.MagicMock()
        expected_cookies = [{"name": "test", "value": "cookie"}]
        scraper.context.cookies.return_value = expected_cookies

        result = scraper.get_cookies()

        assert result == expected_cookies
        scraper.context.cookies.assert_called_once()

    def test_is_logged_in_returns_true_when_logged_in(self, scraper: NextdoorScraper) -> None:
        """Should return True when user is logged in."""
        scraper.page = mock.MagicMock()
        scraper.page.url = NEWS_FEED_URL
        scraper.page.goto.return_value = None

        result = scraper.is_logged_in()

        assert result is True
        scraper.page.goto.assert_called_once_with(NEWS_FEED_URL)

    def test_is_logged_in_returns_false_when_not_logged_in(self, scraper: NextdoorScraper) -> None:
        """Should return False when user is not logged in."""
        scraper.page = mock.MagicMock()
        scraper.page.url = LOGIN_URL
        scraper.page.goto.return_value = None

        result = scraper.is_logged_in()

        assert result is False

    def test_is_logged_in_handles_timeout(self, scraper: NextdoorScraper) -> None:
        """Should return False when navigation times out."""
        scraper.page = mock.MagicMock()
        scraper.page.goto.side_effect = PlaywrightTimeoutError("Timeout")

        result = scraper.is_logged_in()

        assert result is False

    def test_navigate_to_feed_recent(self, scraper: NextdoorScraper) -> None:
        """Should navigate to recent feed."""
        scraper.page = mock.MagicMock()
        scraper.page.goto.return_value = None
        scraper.page.wait_for_selector.return_value = None

        scraper.navigate_to_feed("recent")

        scraper.page.goto.assert_called_once_with(FEED_URLS["recent"])

    def test_navigate_to_feed_trending(self, scraper: NextdoorScraper) -> None:
        """Should navigate to trending feed."""
        scraper.page = mock.MagicMock()
        scraper.page.goto.return_value = None
        scraper.page.wait_for_selector.return_value = None

        scraper.navigate_to_feed("trending")

        scraper.page.goto.assert_called_once_with(FEED_URLS["trending"])

    def test_navigate_to_feed_invalid_type(self, scraper: NextdoorScraper) -> None:
        """Should raise ValueError for invalid feed type."""
        scraper.page = mock.MagicMock()

        with pytest.raises(ValueError, match="Invalid feed type"):
            scraper.navigate_to_feed("invalid")

    def test_navigate_to_feed_requires_browser(self, scraper: NextdoorScraper) -> None:
        """Should raise RuntimeError if browser not started."""
        scraper.page = None

        with pytest.raises(RuntimeError, match="Browser not started"):
            scraper.navigate_to_feed("recent")
