/**
 * hub-bootstrap.js
 * Centralized bootstrapping for all Thinking Hub tools
 */

window.HubBootstrap = (() => {
    let _started = false;

    function start(toolId) {
        if (_started) return;
        _started = true;

        if (!toolId) {
            console.warn('[HubBootstrap] toolId missing');
            return;
        }

        // Data layer
        if (window.HubData) {
            HubData.init(toolId);
        }

        // Cross-tool links
        if (window.HubLinks) {
            HubLinks.init(toolId);
        }

        // Global search (Cmd+K)
        if (window.HubSearch) {
            HubSearch.init();
        }
    }

    return { start };
})();