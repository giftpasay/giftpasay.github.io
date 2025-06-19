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