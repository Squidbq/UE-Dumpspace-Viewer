function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatOffset(offset) {
    if (typeof offset === 'string' && offset.startsWith('0x')) {
        return offset;
    }
    const num = typeof offset === 'number' ? offset : parseInt(offset, 16);
    return `0x${num.toString(16)}`;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

