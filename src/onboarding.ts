import "./styles.css";
import "./onboarding.css";
import { settingsForLevel } from "./core/config";
import type { ManagementLevel } from "./core/types";
import { cipherField } from "./ui/fx";
import { loadRuntimeState, sendMessage } from "./ui/messages";

let selectedLevel: ManagementLevel = "maximum";

const field = document.getElementById("cipherField");
if (field) cipherField(field, 0.12);

document.querySelectorAll<HTMLButtonElement>(".level").forEach((button) => {
  button.addEventListener("click", () => {
    selectedLevel = button.dataset.level as ManagementLevel;
    document
      .querySelectorAll(".level")
      .forEach((item) => item.classList.toggle("selected", item === button));
  });
});

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", async () => {
  const state = await loadRuntimeState();
  const settings = settingsForLevel(state.settings, selectedLevel);
  await sendMessage({
    type: "finish-onboarding",
    settings
  });
  window.close();
});
