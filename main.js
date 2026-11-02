const menuHint = document.querySelector("#menu-hint");
const configPanel = document.querySelector("#config-panel");
const volume = document.querySelector("#volume");
const volumeValue = document.querySelector("#volume-value");

const hasSave = () => {
  try {
    return Boolean(localStorage.getItem("voidStorehouse.save"));
  } catch {
    return false;
  }
};

const continueButton = document.querySelector('[data-action="continue"]');
const savePointButton = document.querySelector('[data-action="save-point"]');

function refreshSaveButtons() {
  const available = hasSave();
  continueButton.disabled = !available;
  savePointButton.disabled = !available;
  continueButton.title = available ? "" : "セーブデータがありません";
  savePointButton.title = available ? "" : "セーブデータがありません";
}

document.querySelectorAll(".menu-button[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;

    switch (button.dataset.action) {
      case "new-game":
        menuHint.textContent = "ENTERING START ROOM...";
        window.location.href = "./game.html";
        break;
      case "continue":
        menuHint.textContent = "CONTINUE SELECTED";
        break;
      case "save-point":
        menuHint.textContent = "SAVE POINT SELECTED";
        break;
      case "config":
        configPanel.hidden = false;
        break;
    }
  });
});

function closeConfig() {
  configPanel.hidden = true;
}

document.querySelector("#close-config").addEventListener("click", closeConfig);
document.querySelector("#config-done").addEventListener("click", closeConfig);
configPanel.addEventListener("click", (event) => {
  if (event.target === configPanel) closeConfig();
});

volume.addEventListener("input", () => {
  volumeValue.value = `${volume.value}%`;
  volumeValue.textContent = `${volume.value}%`;
});

refreshSaveButtons();
