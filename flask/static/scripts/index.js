document.addEventListener("DOMContentLoaded", () => {
    const navbar = document.getElementById("navbar");

    document.addEventListener("scroll", function () {
        const scrollPosition = window.scrollY;
        if (scrollPosition > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const duration = 1000;
                const headerOffset = 80;

                const elementPosition = targetElement.getBoundingClientRect().top;
                const startPosition = window.pageYOffset;
                const offsetPosition = elementPosition + startPosition - headerOffset;
                const distance = offsetPosition - startPosition;

                let startTime = null;

                function animation(currentTime) {
                    if (startTime === null) startTime = currentTime;
                    const timeElapsed = currentTime - startTime;

                    const run = easeInOutCubic(timeElapsed, startPosition, distance, duration);

                    window.scrollTo(0, run);

                    if (timeElapsed < duration) {
                        requestAnimationFrame(animation);
                    }
                }
                function easeInOutCubic(t, b, c, d) {
                    t /= d / 2;
                    if (t < 1) return c / 2 * t * t * t + b;
                    t -= 2;
                    return c / 2 * (t * t * t + 2) + b;
                }

                requestAnimationFrame(animation);
            }
        });
    });
});