(function () {
  var printButton = document.querySelector("[data-print]");
  if (printButton) {
    printButton.addEventListener("click", function () {
      window.print();
    });
  }

  var progress = document.querySelector("[data-progress]");
  var sections = Array.prototype.slice.call(document.querySelectorAll(".section[id]"));
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a"));

  function updateProgress() {
    if (!progress) return;
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    var percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progress.style.width = Math.min(100, Math.max(0, percent)) + "%";
  }

  function updateActiveSection() {
    if (!sections.length) return;
    var current = sections[0].id;
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= 120) {
        current = section.id;
      }
    });
    tocLinks.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === "#" + current);
    });
  }

  function updateReadingState() {
    updateProgress();
    updateActiveSection();
  }

  updateReadingState();
  window.addEventListener("scroll", updateReadingState, { passive: true });
  window.addEventListener("resize", updateReadingState);
})();
