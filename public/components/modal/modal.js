function initializeModal(modalId, triggerId, submitHandler = null) {
    const modal = document.getElementById(modalId);
    const triggerButton = document.getElementById(triggerId);
    const closeButton = modal ? modal.querySelector('.close-button') : null;
    const form = modal ? modal.querySelector('form') : null;

    if (!modal || !triggerButton) {
        console.warn(`Modal with ID "${modalId}" or trigger with ID "${triggerId}" not found.`);
        return;
    }

    triggerButton.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    if (form && submitHandler && typeof submitHandler === 'function') {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitHandler(e);
            modal.style.display = 'none';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeModal('download-modal', 'download-video-button', (e) => {
        alert('Download functionality not implemented yet.');
    });
});
