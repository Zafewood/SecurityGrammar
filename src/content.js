  "use strict";

  const loaderId = setInterval(() => {
    if (!window._gmailjs && !bin) {
        return;
    }

    clearInterval(loaderId);
    injectStylesDirectly();
    startExtension(window._gmailjs);
  }, 100);

  

  function startExtension(gmail) {
    console.log("Extension loading...");
    window.gmail = gmail;

    gmail.observe.on("load", () => {
        const userEmail = gmail.get.user_email();
        console.log("Hello, " + userEmail + ". This is your extension talking!");
    });

    gmail.observe.on("compose", async (compose) => {
      console.log("Compose window detected:", compose);

      try {
        const bodyElement = await waitForBody(compose);

        // Load the BIN numbers from the JSON file
        let bin = null;
        const scriptTag = document.currentScript || document.querySelector('script[data-bin-url]');
        const binUrl = scriptTag ? scriptTag.dataset.binUrl : null;
        if (binUrl) {
          loadNumbers(binUrl).then((loadedBin) => {
            bin = loadedBin; // Assign the resolved Set to bin
            console.log("BIN numbers loaded into global bin:", bin);
            startObserver(bodyElement, bin); // Start MutationObserver
          });
        } else {
          console.error("Failed to retrieve the BIN URL.");
        }
      } catch (error) {
        console.error("Error starting observer:", error);
      }

      document.addEventListener("DOMContentLoaded", () => {
        const scriptTag = document.currentScript || document.querySelector('script[data-style-url]');
        const cssUrl = scriptTag ? scriptTag.dataset.styleUrl : null;
      
        if (cssUrl) {
          loadStylesheet(cssUrl); // Load the stylesheet once the DOM is ready
        } else {
          console.error("Failed to retrieve the stylesheet URL.");
        }
      });
    }); 
  }


  function startObserver(bodyElement, bin) {
    console.log("Starting observer for compose body.");
  
    let previousText = ""; // Track the previous state of the body
    let typedText = ""; // Keep track of digits for the current line
    const processedMatches = new Set(); // Track already processed matches
    let lastAlertTime = 0; // Track the last alert timestamp
  
    // Use MutationObserver to track changes in the compose body
    const observer = new MutationObserver(() => {
      // Get the full text of the body
      const fullText = bodyElement.innerText || ""; // Get all text in the body
      console.log("Full body text:", fullText);
  
      // Split the body text into lines
      const lines = fullText.split("\n");
      const currentLine = lines[lines.length - 1] || ""; // Get the last line
  
      // Extract only digits from the current line
      const currentLineDigits = currentLine.replace(/\D/g, "");
      console.log("Current line digits after processing:", currentLineDigits);
  
      // Check if the body was cleared
      if (fullText.trim() === "" && previousText.trim() !== "") {
        console.log("Body cleared. Resetting all state.");
        typedText = ""; // Reset typed digits completely
        processedMatches.clear(); // Clear all processed matches
      }
  
      // Check if the user typed a new line (Enter key)
      if (previousText !== fullText && fullText.endsWith("\n")) {
        console.log("New line detected. Resetting typed text.");
        typedText = ""; // Reset typed digits for the new line
      }
  
      // Check for a 6-digit match in the BIN set
      if (currentLineDigits.length >= 6) {
        const match = currentLineDigits.slice(-6); // Extract the last 6 digits
  
        // Ensure the alert is not triggered more than once every 30 seconds
        const currentTime = Date.now();
        if (
          !processedMatches.has(match) &&
          checkForSixDigitMatch(match, bin) &&
          currentTime - lastAlertTime >= 30000 // 30 seconds
        ) {
          console.log("New match found:", match);
  
          // Show a popup for the match
          showPopup(bodyElement);
  
          // Add the match to the processed set
          processedMatches.add(match);
  
          // Update the last alert time
          lastAlertTime = currentTime;
  
          // Reset typed digits after detecting a match
          typedText = ""; // Clear typed digits after a match
        } else {
          console.log(
            "Match already processed, invalid, or within the 30-second cooldown:",
            match
          );
        }
      } else {
        // Update typedText to track the digits from the current line
        typedText = currentLineDigits;
      }
  
      // Update previousText for the next mutation
      previousText = fullText;
    });
  
    // Observe changes in the body element
    observer.observe(bodyElement, {
      childList: true,         // Watch for new lines (<div>, <br>, etc.)
      characterData: true,     // Watch for text changes
      subtree: true,           // Include all child nodes
    });
  
    // Add a keydown event listener to detect Enter key
    bodyElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        console.log("Enter key pressed. Resetting typed text.");
        typedText = ""; // Reset typed digits completely on Enter
      }
    });
  
    console.log("Observer started.");
  }  
  
  
  

  function waitForBody(compose) {
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 50;

      const interval = setInterval(() => {
        const bodyElement = document.querySelector("[contenteditable='true']");
        
        if (bodyElement instanceof HTMLElement) {
          clearInterval(interval);
          resolve(bodyElement);
        } else if (retryCount >= maxRetries) {
          clearInterval(interval);
          reject("Failed to locate compose body after retries.");
        } else {
          retryCount++;
        }
      }, 100);
    });
  }

  async function loadNumbers(binUrl) {
    return fetch(binUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then((data) => {
        const bin = new Set(data.map((item) => item.BIN));
        return bin; // Return the bin Set
      })
      .catch((error) => {
        console.error("Error loading JSON:", error);
        return null; // Handle failure gracefully
      });
  }

  function checkForSixDigitMatch(text, bin) {
    if (!(bin instanceof Set)) {
      console.error("Invalid bin object. Expected a Set but got:", bin);
      return false;
    }
    const lastSixChars = text.slice(-6);
    return bin.has(lastSixChars);
  }

  //Show popup
  function showPopup() {
    const popup = document.createElement("div");
    popup.className = "popup";
    popup.innerText = `It seems like you are typing in a credit card. Be aware of frauds or scams!`;
  
    document.body.appendChild(popup);
  
    // Get the current selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect(); // Get the position of the selected text
  
      if (rect) {
        // Position the popup near the text
        const topPosition = rect.bottom + window.scrollY + 10; // Slightly below the text
        const leftPosition = rect.left + window.scrollX; // Align with the left of the text
  
        popup.style.position = "absolute";
        popup.style.top = `${topPosition}px`;
        popup.style.left = `${leftPosition}px`;
        popup.style.zIndex = 1000;
      }
    }
  
    // Remove the popup after 6 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 10000);
  }
  

  function injectStylesDirectly() {
    const style = document.createElement("style");
    style.innerHTML = `
      .popup {
        position: relative;
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
        border-radius: 5px;
        padding: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
        z-index: 1000;
        animation: fadeIn 0.3s ease-in-out;
      }
    `;
  
    document.head.appendChild(style);
  }