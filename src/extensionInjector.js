"use strict";

function addScriptWithResolvedURL(src, url) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = chrome.runtime.getURL(src);

    // Inject the resolved URL for bin.json
    script.dataset.binUrl = chrome.runtime.getURL(url);

    (document.body || document.head || document.documentElement).appendChild(script);
}

// Load the scripts and pass the resolved bin.json URL
addScriptWithResolvedURL("dist/gmailJsLoader.js", "bin.json");
addScriptWithResolvedURL("dist/content.js", "bin.json");