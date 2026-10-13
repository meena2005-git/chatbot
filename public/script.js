const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const sendButton = document.getElementById("send-button");
const typing = document.getElementById("typing");

// Keep the conversation in memory while the page is open.
const messages = [];
let busy = false;

function addMessage(text, role) {
  const isUser = role === "user";

  const box = document.createElement("div");
  box.className = `message ${isUser ? "user" : "bot"}`;

  const sender = document.createElement("strong");
  sender.textContent = isUser ? "You" : "SmartBot";

  const paragraph = document.createElement("div");
  paragraph.className = "message-content";

  if (!isUser && window.marked && window.DOMPurify) {
    // Convert Markdown to HTML, then sanitize it before rendering.
    const html = window.marked.parse(text, {
      breaks: true,
      gfm: true
    });

    paragraph.innerHTML = window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true }
    });

    // Open links safely in a new tab.
    paragraph.querySelectorAll("a").forEach(link => {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
  } else {
    // Safe fallback: display plain text.
    paragraph.textContent = text;
  }

  box.append(sender, paragraph);
  chatBox.appendChild(box);
  chatBox.scrollTop = chatBox.scrollHeight;
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const text = input.value.trim();

  if (!text || busy) return;

  addMessage(text, "user");
  messages.push({ role: "user", content: text });

  input.value = "";
  busy = true;
  sendButton.disabled = true;
  typing.hidden = false;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages.slice(-12)
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Server returned an invalid response. Please try again.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Unable to get AI response.");
    }

    if (typeof data.reply !== "string") {
      throw new Error("Invalid response from the server.");
    }

    addMessage(data.reply, "assistant");

    messages.push({
      role: "assistant",
      content: data.reply
    });

    // Keep conversation size limited.
    if (messages.length > 12) {
      messages.splice(0, messages.length - 12);
    }
  } catch (error) {
    addMessage(
      error.message || "Connection error. Please try again.",
      "assistant"
    );
  } finally {
    busy = false;
    sendButton.disabled = false;
    typing.hidden = true;
    input.focus();
  }
});