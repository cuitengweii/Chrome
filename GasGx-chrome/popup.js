const openOptionsLink = document.getElementById("openOptions");
const popupStatus = document.getElementById("popupStatus");

openOptionsLink.addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    await chrome.runtime.openOptionsPage();
    window.close();
  } catch (error) {
    console.error("[GasGx Collector] Failed to open options", error);
    popupStatus.textContent = `Failed to open settings: ${error.message}`;
  }
});
