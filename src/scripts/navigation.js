class NavigationManager {
    constructor(app) {
        this.app = app;
    }

    saveNavigationState() {
        if (this.app.isNavigatingHistory) {
            return;
        }

        const currentState = this.getCurrentNavigationState();
        if (!currentState) {
            return;
        }

        const lastState = this.app.navigationHistory[this.app.navigationHistoryIndex];

        if (lastState && this.compareNavigationStates(currentState, lastState)) {
            return;
        }

        const now = Date.now();
        if (this.app.lastSaveTime && now - this.app.lastSaveTime < 50) {
            return;
        }
        this.app.lastSaveTime = now;

        const hadFutureHistory = this.app.navigationHistoryIndex < this.app.navigationHistory.length - 1;
        if (hadFutureHistory) {
            this.app.navigationHistory = this.app.navigationHistory.slice(0, this.app.navigationHistoryIndex + 1);
        }

        this.app.navigationHistory.push(currentState);
        this.app.navigationHistoryIndex = this.app.navigationHistory.length - 1;

        const maxHistory = 50;
        if (this.app.navigationHistory.length > maxHistory) {
            this.app.navigationHistory.shift();
            this.app.navigationHistoryIndex--;
        }
    }


    getCurrentNavigationState() {
        const item = this.app.currentDetailItem;

        if (!item) {
            return null;
        }

        let itemInfo = null;

        const isFunctionClass = (item.type === 'function-class' || (item.functions && Array.isArray(item.functions))) && 
                                this.app.currentCategory === 'functions';

        if (isFunctionClass && item.name) {
            itemInfo = {
                name: item.name,
                type: 'function-class',
                category: 'functions'
            };
        } else {
            const itemName = item.name || item.funcName || item.className;
            if (!itemName) {
                return null;
            }

            itemInfo = {
                name: itemName,
                type: item.type || item.searchType,
                category: this.app.currentCategory,
                className: item.className || null
            };
        }

        if (!itemInfo || !itemInfo.name) {
            return null;
        }

        return {
            category: this.app.currentCategory,
            item: itemInfo,
            highlightQuery: this.app.highlightQuery,
            activeTab: document.querySelector('.detail-tab.active')?.getAttribute('data-tab') || 'overview',
            sidebarScroll: document.getElementById('sidebarList')?.scrollTop || 0,
            detailScroll: document.getElementById('detailContentMain')?.scrollTop || 0
        };
    }

    compareNavigationStates(state1, state2) {
        if (!state1 || !state2) return false;
        if (state1.category !== state2.category) return false;
        if (state1.activeTab !== state2.activeTab) return false;
        if (state1.highlightQuery !== state2.highlightQuery) return false;

        const item1 = state1.item;
        const item2 = state2.item;
        if (!item1 && !item2) return true;
        if (!item1 || !item2) return false;
        if (item1.name !== item2.name) return false;
        if (item1.type !== item2.type) return false;
        if (item1.category !== item2.category) return false;

        return true;
    }

    navigateBack() {
        if (this.app.navigationHistoryIndex <= 0) {
            return;
        }

        this.app.isNavigatingHistory = true;

        this.app.navigationHistoryIndex--;
        const state = this.app.navigationHistory[this.app.navigationHistoryIndex];

        this.restoreNavigationState(state);

        setTimeout(() => {
            this.app.isNavigatingHistory = false;
        }, 200);
    }

    navigateForward() {
        if (this.app.navigationHistoryIndex >= this.app.navigationHistory.length - 1) {
            return;
        }

        this.app.isNavigatingHistory = true;

        this.app.navigationHistoryIndex++;
        const state = this.app.navigationHistory[this.app.navigationHistoryIndex];

        this.restoreNavigationState(state);

        setTimeout(() => {
            this.app.isNavigatingHistory = false;
        }, 200);
    }

    printNavigationHistory() {
        if (!this.app.navigationHistory || this.app.navigationHistory.length === 0) {
            return;
        }
        
        const historyInfo = this.app.navigationHistory.map((state, index) => {
            const itemName = state.item?.name || 'Unknown';
            const category = state.category || 'Unknown';
            const isCurrent = index === this.app.navigationHistoryIndex;
            return `${isCurrent ? '→' : ' '} [${index}] ${category}: ${itemName}`;
        }).join('\n');
        
        return historyInfo;
    }

    restoreNavigationState(state) {
        if (!state) return;

        if (state.item) {
            let item = null;
            const category = state.category || state.item.category;

            if (state.item.type === 'function-class' && category === 'functions') {
                const classMap = new Map();
                this.app.indexes.functions.forEach((funcItem) => {
                    const className = funcItem.className || 'Unknown';
                    if (!classMap.has(className)) {
                        classMap.set(className, {
                            name: className,
                            type: 'function-class',
                            functions: []
                        });
                    }
                    classMap.get(className).functions.push(funcItem);
                });
                item = classMap.get(state.item.name);
            } else {
                if (category === 'classes') {
                    item = this.app.indexes.classes.get(state.item.name);
                } else if (category === 'structs') {
                    item = this.app.indexes.structs.get(state.item.name);
                } else if (category === 'functions') {
                    if (state.item.type === 'function-class' || !state.item.className) {
                        const classMap = new Map();
                        this.app.indexes.functions.forEach((funcItem) => {
                            const className = funcItem.className || 'Unknown';
                            if (!classMap.has(className)) {
                                classMap.set(className, {
                                    name: className,
                                    type: 'function-class',
                                    functions: []
                                });
                            }
                            classMap.get(className).functions.push(funcItem);
                        });
                        item = classMap.get(state.item.name);
                    }

                    if (!item) {
                        if (state.item.className) {
                            this.app.indexes.functions.forEach((funcItem) => {
                                if (funcItem.className === state.item.className && 
                                    (funcItem.funcName === state.item.name || funcItem.name === state.item.name)) {
                                    item = funcItem;
                                }
                            });
                        } else {
                            item = this.app.indexes.functions.get(state.item.name);
                        }
                    }
                } else if (category === 'enums') {
                    item = this.app.indexes.enums.get(state.item.name);
                } else if (category === 'offsets') {
                    item = this.app.indexes.offsets.get(state.item.name);
                }
            }

            if (item) {
                if (this.app.currentCategory !== category) {
                    this.app.switchCategory(category, item);
                } else {
                    this.app.showDetail(item, state.highlightQuery);
                }

                setTimeout(() => {
                    const isFunctionClass = this.app.currentDetailItem && 
                                          (this.app.currentDetailItem.type === 'function-class' || 
                                           (this.app.currentDetailItem.functions && Array.isArray(this.app.currentDetailItem.functions))) &&
                                          this.app.currentCategory === 'functions';

                    if (state.activeTab && !isFunctionClass) {
                        this.app.switchDetailTab(state.activeTab);
                    }

                    if (state.sidebarScroll !== undefined && state.sidebarScroll !== null) {
                        const sidebarList = document.getElementById('sidebarList');
                        if (sidebarList) {
                            sidebarList.scrollTop = state.sidebarScroll;
                        }
                    }

                    if (state.detailScroll !== undefined && state.detailScroll !== null) {
                        const detailContent = document.getElementById('detailContentMain');
                        if (detailContent) {
                            detailContent.scrollTop = state.detailScroll;
                        }
                    }
                }, 150);
            } else {
                console.warn('Could not restore item:', state.item);
            }
        } else {
            if (state.category && this.app.currentCategory !== state.category) {
                this.app.switchCategory(state.category);
            }
        }
    }
}

