// Function to handle intersection
function handleIntersection(entries, observer) {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            // Add a delay based on the element's index and a custom delay
            const customDelay = 0.6; // Adjust this value to set the custom delay in seconds
            entry.target.style.transitionDelay = `${index * 0.2 + customDelay}s`;
            entry.target.classList.add('anim-fade');
            observer.unobserve(entry.target);
        }
    });
}

// Set up Intersection Observer
const observer = new IntersectionObserver(handleIntersection, {
    threshold: 0.1 // Adjust this value to control when the animation triggers
});

// Add observer to all elements with class 'anim'
document.querySelectorAll('.anim').forEach(element => {
    observer.observe(element);
});

document.addEventListener('DOMContentLoaded', () => {
    const typedTextSpan = document.getElementById('typed-text');
    const words = ["UPC", "GIFT", "PASAY"];
    const typingDelay = 200;
    const wordDelay = 1000;
    let wordIndex = 0;
    let charIndex = 0;

    function type() {
        if (wordIndex < words.length) {
            if (charIndex < words[wordIndex].length) {
                typedTextSpan.textContent += words[wordIndex].charAt(charIndex);
                charIndex++;
                setTimeout(type, typingDelay);
            } else {
                setTimeout(nextWord, wordDelay);
            }
        }
    }

    function nextWord() {
        wordIndex++;
        charIndex = 0;
        typedTextSpan.textContent = '';
        if (wordIndex < words.length) {
            type();
        } else {
            // Optional: Restart the animation
            wordIndex = 0;
            setTimeout(type, wordDelay);
        }
    }

    type();
});

// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // Select the navbar element
    const navbar = document.querySelector('.about-page .navbar');

    // Set a scroll threshold (e.g., 10 pixels)
    const scrollThreshold = 10;

    // Listen for the scroll event on the window
    window.addEventListener('scroll', function () {
        // Check if the vertical scroll position is greater than the threshold
        if (window.scrollY > scrollThreshold) {
            // If so, add the 'scrolled' class to the navbar
            navbar.classList.add('scrolled');
        } else {
            // Otherwise, remove the 'scrolled' class
            navbar.classList.remove('scrolled');
        }
    });
});