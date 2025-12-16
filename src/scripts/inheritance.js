class InheritanceViewer {
    constructor() {
        this.inheritanceCache = new Map();
    }

    displayInheritancePath(item) {
        const inheritancePath = document.getElementById('inheritancePath');
        if (!inheritancePath) return;

        const itemType = item.type || item.searchType;
        
        if (itemType !== 'class' && itemType !== 'classes' && itemType !== 'struct' && itemType !== 'structs') {
            inheritancePath.innerHTML = '';
            return;
        }

        const inheritInfo = this.getInheritanceInfo(item);
        
        if (!inheritInfo || inheritInfo.length === 0) {
            inheritancePath.innerHTML = '<span class="inheritance-path-item">No inheritance</span>';
            return;
        }

        const chain = [...inheritInfo].reverse();
        const currentName = item.name || item.className || 'Unknown';
        chain.push(currentName);

        let html = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="margin-right: 0.5rem;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>';
        
        chain.forEach((className, index) => {
            html += `<span class="inheritance-path-item" data-class="${this.escapeHtml(className)}">${this.escapeHtml(className)}</span>`;
            if (index < chain.length - 1) {
                html += '<span class="inheritance-path-arrow"> > </span>';
            }
        });

        const children = this.findChildren(item.name || item.className);
        const hasChildren = children && children.length > 0;
        const hasParents = inheritInfo && inheritInfo.length > 0;
        
        if (hasChildren || hasParents) {
            html += '<div class="inheritance-navigation">';
            if (hasParents) {
                html += `<button class="inheritance-nav-btn" data-action="show-parents" title="Show parent classes">Parents (${inheritInfo.length})</button>`;
            }
            if (hasChildren) {
                html += `<button class="inheritance-nav-btn" data-action="show-children" title="Show child classes">Children (${children.length})</button>`;
            }
            html += `<button class="inheritance-nav-btn" data-action="show-graph" title="Open inheritance graph view">Graph View</button>`;
            html += '</div>';
            
            if (hasParents) {
                html += `<div class="inheritance-children" id="inheritanceParents" style="display: none;">`;
                html += `<div class="inheritance-children-header">`;
                html += `<div class="inheritance-children-title">Parent Classes (${inheritInfo.length}):</div>`;
                html += `<button class="inheritance-children-close" data-target="inheritanceParents" title="Close" aria-label="Close">×</button>`;
                html += `</div>`;
                html += `<div class="inheritance-children-list">`;
                [...inheritInfo].reverse().forEach(parentName => {
                    html += `<span class="inheritance-child-item" data-class="${this.escapeHtml(parentName)}">${this.escapeHtml(parentName)}</span>`;
                });
                html += `</div></div>`;
            }
            
            if (hasChildren) {
                html += `<div class="inheritance-children" id="inheritanceChildren" style="display: none;">`;
                html += `<div class="inheritance-children-header">`;
                html += `<div class="inheritance-children-title">Child Classes (${children.length}):</div>`;
                html += `<button class="inheritance-children-close" data-target="inheritanceChildren" title="Close" aria-label="Close">×</button>`;
                html += `</div>`;
                html += `<div class="inheritance-children-list">`;
                children.forEach(childName => {
                    html += `<span class="inheritance-child-item" data-class="${this.escapeHtml(childName)}">${this.escapeHtml(childName)}</span>`;
                });
                html += `</div></div>`;
            }
        }
        
        inheritancePath.innerHTML = html;

        inheritancePath.querySelectorAll('.inheritance-path-item').forEach(element => {
            element.addEventListener('click', (e) => {
                const className = e.currentTarget.getAttribute('data-class');
                if (className) {
                    this.navigateToClass(className);
                }
            });
        });
        
        inheritancePath.querySelectorAll('.inheritance-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.getAttribute('data-action');
                if (action === 'show-children') {
                    const childrenDiv = document.getElementById('inheritanceChildren');
                    if (childrenDiv) {
                        const parentsDiv = document.getElementById('inheritanceParents');
                        if (parentsDiv) {
                            parentsDiv.style.display = 'none';
                        }
                        childrenDiv.style.display = childrenDiv.style.display === 'none' ? 'block' : 'none';
                    }
                } else if (action === 'show-parents') {
                    const parentsDiv = document.getElementById('inheritanceParents');
                    if (parentsDiv) {
                        const childrenDiv = document.getElementById('inheritanceChildren');
                        if (childrenDiv) {
                            childrenDiv.style.display = 'none';
                        }
                        parentsDiv.style.display = parentsDiv.style.display === 'none' ? 'block' : 'none';
                    }
                } else if (action === 'show-graph') {
                    this.openInheritanceGraph(item, 'both');
                }
            });
        });
        
        inheritancePath.querySelectorAll('.inheritance-children-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = closeBtn.getAttribute('data-target');
                if (targetId) {
                    const targetDiv = document.getElementById(targetId);
                    if (targetDiv) {
                        targetDiv.style.display = 'none';
                    }
                }
            });
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const childrenDiv = document.getElementById('inheritanceChildren');
                const parentsDiv = document.getElementById('inheritanceParents');
                if (childrenDiv && childrenDiv.style.display !== 'none') {
                    childrenDiv.style.display = 'none';
                }
                if (parentsDiv && parentsDiv.style.display !== 'none') {
                    parentsDiv.style.display = 'none';
                }
            }
        }, { once: false });
        
        inheritancePath.querySelectorAll('.inheritance-child-item').forEach(element => {
            element.addEventListener('click', (e) => {
                const className = e.currentTarget.getAttribute('data-class');
                if (className) {
                    this.navigateToClass(className);
                }
            });
        });
    }
    
    findChildren(className) {
        if (!className || !window.app || !window.app.indexes) {
            return [];
        }
        
        const children = [];
        const classIndex = window.app.indexes.classes;
        const structIndex = window.app.indexes.structs;
        
        [classIndex, structIndex].forEach(index => {
            if (index) {
                index.forEach((item) => {
                    const inheritInfo = this.getInheritanceInfo(item);
                    if (inheritInfo && Array.isArray(inheritInfo)) {
                        if (inheritInfo.includes(className)) {
                            children.push(item.name || item.className);
                        }
                    }
                });
            }
        });
        
        return children.sort();
    }

    displayInheritanceTreeFull(item) {
        const inheritanceTree = document.getElementById('inheritanceTree');
        if (!inheritanceTree) return;

        const inheritInfo = this.getInheritanceInfo(item);
        
        if (!inheritInfo || inheritInfo.length === 0) {
            inheritanceTree.innerHTML = '<div class="inheritance-item-full">No inheritance information</div>';
            return;
        }

        const chain = [...inheritInfo];
        const currentName = item.name || item.className || 'Unknown';
        chain.push(currentName);

        let html = '';
        chain.forEach((className, index) => {
            const isLast = index === chain.length - 1;
            
            html += '<div class="inheritance-item-full';
            if (isLast) {
                html += ' active';
            }
            html += '" data-class="' + this.escapeHtml(className) + '">';
            
            if (!isLast) {
                html += '<span class="inheritance-arrow-full">↓</span>';
            }
            
            html += '<span>' + this.escapeHtml(className) + '</span>';
            html += '</div>';
        });

        inheritanceTree.innerHTML = html;

        inheritanceTree.querySelectorAll('.inheritance-item-full').forEach(element => {
            element.addEventListener('click', (e) => {
                const className = e.currentTarget.getAttribute('data-class');
                if (className) {
                    this.navigateToClass(className);
                }
            });
        });
    }

    getInheritanceInfo(item) {
        if (!item.data || !Array.isArray(item.data)) {
            return null;
        }

        for (const member of item.data) {
            if (typeof member === 'object' && member !== null) {
                const entries = Object.entries(member);
                for (const [key, value] of entries) {
                    if (key === '__InheritInfo' && Array.isArray(value)) {
                        return value;
                    }
                }
            }
        }

        return null;
    }

    openInheritanceGraph(item, mode) {
        if (window.inheritanceGraph) {
            window.inheritanceGraph.open(item, mode);
        }
    }

    navigateToClass(className) {
        let foundItem = null;
        let category = 'classes';

        const classItem = window.app.indexes.classes.get(className);
        if (classItem) {
            foundItem = classItem;
            category = 'classes';
        } else {
            const structItem = window.app.indexes.structs.get(className);
            if (structItem) {
                foundItem = structItem;
                category = 'structs';
            }
        }

        if (!foundItem) {
            return;
        }

        if (window.app.currentDetailItem && window.app.currentDetailItem === foundItem) {
            return;
        }

        const currentName = window.app.currentDetailItem?.name || window.app.currentDetailItem?.className || window.app.currentDetailItem?.funcName;
        const itemName = foundItem.name || foundItem.className || foundItem.funcName;
        if (currentName === itemName && window.app.currentCategory === category) {
            return;
        }

        window.app.switchCategory(category, foundItem);
    }

    displayMembers(item) {
        const membersList = document.getElementById('membersList');
        if (!membersList) return;

        if (!item.data || !Array.isArray(item.data)) {
            membersList.innerHTML = '<div class="member-item">No members found</div>';
            return;
        }

        const members = [];
        
        for (const member of item.data) {
            if (typeof member === 'object' && member !== null) {
                const entries = Object.entries(member);
                for (const [memberName, memberData] of entries) {
                    if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                        continue;
                    }

                    if (Array.isArray(memberData) && memberData.length >= 2) {
                        const offset = memberData[1];
                        const size = memberData[2] || 0;
                        let typeInfo = 'Unknown';
                        if (Array.isArray(memberData[0])) {
                            const typeArray = memberData[0];
                            if (typeArray.length > 0) {
                                typeInfo = this.formatType(typeArray);
                            }
                        }

                        members.push({
                            name: memberName,
                            type: typeInfo,
                            offset: offset,
                            size: size
                        });
                    }
                }
            }
        }

        members.sort((a, b) => a.offset - b.offset);

        if (members.length === 0) {
            membersList.innerHTML = '<div class="member-item">No members found</div>';
            return;
        }

        let html = '';
        members.forEach(member => {
            const offsetHex = '0x' + member.offset.toString(16);
            html += `
                <div class="member-item">
                    <div>
                        <span class="member-name">${this.escapeHtml(member.name)}</span>
                        <span class="member-type">${this.escapeHtml(member.type)}</span>
                    </div>
                    <span class="member-offset">${offsetHex}</span>
                </div>
            `;
        });

        membersList.innerHTML = html;
    }

    formatType(typeArray) {
        if (!Array.isArray(typeArray) || typeArray.length === 0) {
            return 'Unknown';
        }

        const typeName = typeArray[0];
        const typeCategory = typeArray[1] || '';
        const typeModifier = typeArray[2] || '';
        const typeParams = typeArray[3] || [];

        let formatted = typeName;

        if (typeModifier === '*' || typeCategory === '*') {
            formatted += '*';
        }

        if (Array.isArray(typeParams) && typeParams.length > 0) {
            const paramType = typeParams[0];
            if (Array.isArray(paramType)) {
                formatted = `TArray<${this.formatType(paramType)}>`;
            } else {
                formatted = `TArray<${paramType}>`;
            }
        }

        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getFullInheritanceChain(item) {
        const chain = [];
        const inheritInfo = this.getInheritanceInfo(item);
        
        if (inheritInfo && Array.isArray(inheritInfo)) {
            chain.push(...inheritInfo);
        }
        
        if (item.name) {
            chain.unshift(item.name);
        } else if (item.className) {
            chain.unshift(item.className);
        }

        return chain;
    }

    getAllMembersIncludingInherited(item) {
        const members = new Map();
        const chain = this.getFullInheritanceChain(item);

        for (const className of chain) {
            const classItem = window.app.indexes.classes.get(className) || 
                            window.app.indexes.structs.get(className);
            
            if (classItem && classItem.data) {
                for (const member of classItem.data) {
                    if (typeof member === 'object' && member !== null) {
                        const entries = Object.entries(member);
                        for (const [memberName, memberData] of entries) {
                            if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                                continue;
                            }
                            if (!members.has(memberName)) {
                                members.set(memberName, {
                                    name: memberName,
                                    data: memberData,
                                    fromClass: className
                                });
                            }
                        }
                    }
                }
            }
        }

        return Array.from(members.values());
    }
}

window.inheritanceViewer = new InheritanceViewer();

