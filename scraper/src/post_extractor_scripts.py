"""Injected JavaScript for extracting Nextdoor feed DOM (used by PostExtractor)."""

from __future__ import annotations


def _get_extraction_script(min_content_length: int) -> str:
    """Generate JavaScript to extract post data from DOM.

    Args:
        min_content_length: Minimum content length to include a post.

    Returns:
        JavaScript code string.
    """
    # Selectors used in JavaScript extraction
    author_sel = 'a[href*="/profile/"][href*="is=feed_author"]'
    timestamp_sel = '[data-testid="post-timestamp"]'
    content_sel = '[data-testid="styled-text"]'
    image_sel = '[data-testid="resized-image"], img.resized-image'
    reaction_sel = '[data-testid="reaction-button-text"]'
    reply_sel = '[data-testid="post-reply-button"]'

    return f"""
(() => {{
    const posts = [];
    const MIN_LEN = {min_content_length};
    const AUTHOR_SEL = '{author_sel}';
    const TIMESTAMP_SEL = '{timestamp_sel}';
    const CONTENT_SEL = '{content_sel}';
    const IMAGE_SEL = '{image_sel}';
    const REACTION_SEL = '{reaction_sel}';
    const REPLY_SEL = '{reply_sel}';

    const containers = document.querySelectorAll('div.post, div.js-media-post');
    containers.forEach((el, containerIndex) => {{
        try {{
            if (el.textContent?.includes('Sponsored')) return;
            if (el.closest('[class*="gam-ad"], [class*="ad-placeholder"], [class*="feed-gam-ad"]')) return;

            const authorLink = el.querySelector(AUTHOR_SEL);
            if (!authorLink) return;

            const href = authorLink.getAttribute('href') || '';
            const match = href.match(/\\/profile\\/([^/?]+)/);
            const authorId = match?.[1];
            if (!authorId) return;

            let authorName = '';
            for (const link of el.querySelectorAll(AUTHOR_SEL)) {{
                const t = link.textContent?.trim() || '';
                if (t && !t.startsWith('Avatar for') && t.length > 1) {{
                    authorName = t;
                    break;
                }}
            }}

            const hoodLink = el.querySelector('a[href*="/neighborhood/"]');
            const neighborhood = hoodLink?.textContent?.trim() || null;

            const tsEl = el.querySelector(TIMESTAMP_SEL);
            const timestamp = tsEl?.textContent?.trim() || null;

            const contentEl = el.querySelector(CONTENT_SEL);
            const content = contentEl?.textContent?.trim() || '';
            if (!content || content.length < MIN_LEN) return;

            let postUrl = null;
            const timestampLink = el.querySelector(TIMESTAMP_SEL + ' a[href*="/p/"]');
            const postLink = timestampLink || el.querySelector('a[href*="/p/"], a[href*="/for_sale_and_free/"]');
            if (postLink) {{
                const h = postLink.getAttribute('href');
                if (h) postUrl = h.startsWith('http') ? h : (window.location.origin + (h.startsWith('/') ? h : '/' + h));
            }}

            const imgs = el.querySelectorAll(IMAGE_SEL);
            const imageUrls = Array.from(imgs).map(i => i.src).filter(Boolean);

            const rxEl = el.querySelector(REACTION_SEL);
            const reactionCount = parseInt(rxEl?.textContent || '0', 10) || 0;

            const replyEl = el.querySelector(REPLY_SEL);
            const commentCount = replyEl ? (parseInt(replyEl.textContent?.trim() || '0', 10) || 0) : null;

            const isClassified =
                (postUrl && postUrl.includes('/for_sale_and_free/')) ||
                el.querySelector('a[href*="/for_sale_and_free/"]') ||
                el.querySelector('[data-icon="forsale-off"]');
            const postType = isClassified ? 'classified' : 'standard';

            let price = null;
            if (isClassified) {{
                const thumbBlock = el.querySelector('img.resized-image')?.closest('div');
                if (thumbBlock) {{
                    const spans = thumbBlock.querySelectorAll('span');
                    for (const s of spans) {{
                        const t = (s.textContent || '').trim();
                        if (t && (t === 'Free' || t.startsWith('$'))) {{ price = t; break; }}
                    }}
                }}
            }}

            posts.push({{
                authorId, authorName, commentCount, content, imageUrls,
                neighborhood, postType, postUrl, price, reactionCount, timestamp,
                containerIndex,
                postIndex: posts.length
            }});
        }} catch (e) {{
            console.error('Extract error:', e);
        }}
    }});

    return posts;
}})()
"""


def _get_first_visible_post_script(min_content_length: int) -> str:
    """Generate JavaScript to find the first post container in the viewport and return its index and raw data."""
    author_sel = 'a[href*="/profile/"][href*="is=feed_author"]'
    timestamp_sel = '[data-testid="post-timestamp"]'
    content_sel = '[data-testid="styled-text"]'
    image_sel = '[data-testid="resized-image"], img.resized-image'
    reaction_sel = '[data-testid="reaction-button-text"]'
    reply_sel = '[data-testid="post-reply-button"]'

    return f"""
(() => {{
    const MIN_LEN = {min_content_length};
    const AUTHOR_SEL = '{author_sel}';
    const TIMESTAMP_SEL = '{timestamp_sel}';
    const CONTENT_SEL = '{content_sel}';
    const IMAGE_SEL = '{image_sel}';
    const REACTION_SEL = '{reaction_sel}';
    const REPLY_SEL = '{reply_sel}';

    const containers = document.querySelectorAll('div.post, div.js-media-post');
    for (let containerIndex = 0; containerIndex < containers.length; containerIndex++) {{
        const el = containers[containerIndex];
        try {{
            if (el.textContent?.includes('Sponsored')) continue;
            if (el.closest('[class*="gam-ad"], [class*="ad-placeholder"], [class*="feed-gam-ad"]')) continue;

            const rect = el.getBoundingClientRect();
            if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

            const authorLink = el.querySelector(AUTHOR_SEL);
            if (!authorLink) continue;

            const href = authorLink.getAttribute('href') || '';
            const match = href.match(/\\/profile\\/([^/?]+)/);
            const authorId = match?.[1];
            if (!authorId) continue;

            let authorName = '';
            for (const link of el.querySelectorAll(AUTHOR_SEL)) {{
                const t = link.textContent?.trim() || '';
                if (t && !t.startsWith('Avatar for') && t.length > 1) {{ authorName = t; break; }}
            }}

            const hoodLink = el.querySelector('a[href*="/neighborhood/"]');
            const neighborhood = hoodLink?.textContent?.trim() || null;

            const tsEl = el.querySelector(TIMESTAMP_SEL);
            const timestamp = tsEl?.textContent?.trim() || null;

            const contentEl = el.querySelector(CONTENT_SEL);
            const content = contentEl?.textContent?.trim() || '';
            if (!content || content.length < MIN_LEN) continue;

            let postUrl = null;
            const timestampLink = el.querySelector(TIMESTAMP_SEL + ' a[href*="/p/"]');
            const postLink = timestampLink || el.querySelector('a[href*="/p/"], a[href*="/for_sale_and_free/"]');
            if (postLink) {{
                const h = postLink.getAttribute('href');
                if (h) postUrl = h.startsWith('http') ? h : (window.location.origin + (h.startsWith('/') ? h : '/' + h));
            }}

            const imgs = el.querySelectorAll(IMAGE_SEL);
            const imageUrls = Array.from(imgs).map(i => i.src).filter(Boolean);

            const rxEl = el.querySelector(REACTION_SEL);
            const reactionCount = parseInt(rxEl?.textContent || '0', 10) || 0;

            const replyEl = el.querySelector(REPLY_SEL);
            const commentCount = replyEl ? (parseInt(replyEl.textContent?.trim() || '0', 10) || 0) : null;

            const isClassified =
                (postUrl && postUrl.includes('/for_sale_and_free/')) ||
                el.querySelector('a[href*="/for_sale_and_free/"]') ||
                el.querySelector('[data-icon="forsale-off"]');
            const postType = isClassified ? 'classified' : 'standard';

            let price = null;
            if (isClassified) {{
                const thumbBlock = el.querySelector('img.resized-image')?.closest('div');
                if (thumbBlock) {{
                    const spans = thumbBlock.querySelectorAll('span');
                    for (const s of spans) {{
                        const t = (s.textContent || '').trim();
                        if (t && (t === 'Free' || t.startsWith('$'))) {{ price = t; break; }}
                    }}
                }}
            }}

            return {{
                containerIndex,
                raw: {{
                    authorId, authorName, commentCount, content, imageUrls,
                    neighborhood, postType, postUrl, price, reactionCount, timestamp,
                    containerIndex,
                    postIndex: 0
                }}
            }};
        }} catch (e) {{ continue; }}
    }}
    return null;
}})()
"""
