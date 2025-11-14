document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".category h3").forEach(header => {
    header.addEventListener("click", () => {
      const list = header.nextElementSibling;
      const toggle = header.querySelector(".toggle");
      const open = list.style.display === "flex";
      list.style.display = open ? "none" : "flex";
      toggle.textContent = open ? "+" : "×";
    });
  });
});