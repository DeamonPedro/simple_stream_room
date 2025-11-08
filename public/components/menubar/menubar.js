document.addEventListener("DOMContentLoaded", () => {
    const menubars = document.querySelectorAll(".menubar");

    const closeAllMenus = (menubar) => {
        menubar.querySelectorAll(".menubar-trigger").forEach((trigger) => {
            trigger.setAttribute("data-state", "closed");
            trigger.setAttribute("aria-expanded", "false");
        });
        menubar.querySelectorAll(".menubar-content").forEach((content) => {
            content.setAttribute("data-state", "closed");
        });
        menubar.querySelectorAll(".menubar-sub-content").forEach((subContent) => {
            subContent.setAttribute("data-state", "closed");
        });
        menubar.querySelectorAll(".menubar-sub-trigger").forEach((subTrigger) => {
            subTrigger.setAttribute("aria-expanded", "false");
        });
    };

    const closeSubMenus = (menuContent) => {
        menuContent
            .querySelectorAll(".menubar-sub-content")
            .forEach((subContent) => {
                subContent.setAttribute("data-state", "closed");
            });
        menuContent
            .querySelectorAll(".menubar-sub-trigger")
            .forEach((subTrigger) => {
                subTrigger.setAttribute("aria-expanded", "false");
            });
    };

    menubars.forEach((menubar) => {
        const triggers = menubar.querySelectorAll(".menubar-trigger");

        triggers.forEach((trigger) => {
            const menuContent = trigger.nextElementSibling;

            trigger.addEventListener("click", (e) => {
                e.stopPropagation();
                const currentState = trigger.getAttribute("data-state");
                const isExpanded = trigger.getAttribute("aria-expanded") === "true";

                closeAllMenus(menubar);
                if (currentState === "closed" || !isExpanded) {
                    trigger.setAttribute("data-state", "open");
                    trigger.setAttribute("aria-expanded", "true");
                    menuContent.setAttribute("data-state", "open");
                }
            });
        });

        const subTriggers = menubar.querySelectorAll(".menubar-sub-trigger");
        subTriggers.forEach((subTrigger) => {
            const subMenuContent = subTrigger.nextElementSibling;
            const parentMenuContent = subTrigger.closest(".menubar-content");

            subTrigger.addEventListener("mouseenter", () => {
                closeSubMenus(parentMenuContent);
                subMenuContent.setAttribute("data-state", "open");
                subTrigger.setAttribute("aria-expanded", "true");
            });
        });

        document.addEventListener("click", (e) => {
            if (!menubar.contains(e.target)) {
                closeAllMenus(menubar);
            }
        });

        menubar.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeAllMenus(menubar);

                const openTrigger = menubar.querySelector(
                    '.menubar-trigger[data-state="open"]'
                );
                if (openTrigger) openTrigger.focus();
            }
        });
    });
});
