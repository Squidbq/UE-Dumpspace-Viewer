class OffsetsGenerator {
    constructor() {
        this.defaultOptions = {
            format: 'cpp',
            offsetType: 'relative',
            namespaceStyle: 'flat',
            mainNamespace: 'Offsets'
        };
    }

    generateFromCollection(collection, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        this.calculateRelativeOffsets(collection);
        
        if (opts.format === 'csharp') {
            return this.generateCSharpCode(collection, opts);
        } else {
            return this.generateCppCode(collection, opts);
        }
    }

    calculateRelativeOffsets(collection) {
        collection.members.forEach(member => {
            const memberClass = member.className;
            const parentClassSize = this.getParentClassSize(memberClass);
            member.relativeOffset = member.offset - parentClassSize;
            
            if (member.relativeOffset < 0) {
                console.warn(`Negative relative offset for ${member.memberName} in ${memberClass}, using 0`);
                member.relativeOffset = 0;
            }
        });
    }

    getParentClassSize(className) {
        if (!window.app || !window.app.indexes) {
            return 0;
        }
        
        const classItem = window.app.indexes.classes.get(className) || 
                         window.app.indexes.structs.get(className);
        
        if (!classItem) {
            return 0;
        }
        
        let inheritanceChain = [];
        if (window.inheritanceViewer) {
            const chainInfo = window.inheritanceViewer.getInheritanceInfo(classItem);
            if (chainInfo && Array.isArray(chainInfo)) {
                inheritanceChain = chainInfo;
            }
        }
        
        if (inheritanceChain.length <= 1) {
            return 0;
        }
        
        const parentClassName = inheritanceChain[inheritanceChain.length - 2];
        const parentClassItem = window.app.indexes.classes.get(parentClassName) || 
                               window.app.indexes.structs.get(parentClassName);
        
        if (!parentClassItem || !parentClassItem.data) {
            return 0;
        }
        
        let parentSize = 0;
        if (Array.isArray(parentClassItem.data)) {
            parentClassItem.data.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    Object.entries(item).forEach(([name, data]) => {
                        if (Array.isArray(data) && data.length >= 2) {
                            const offset = data[1];
                            const memberSize = data[2] || 0;
                            parentSize = Math.max(parentSize, offset + memberSize);
                        }
                    });
                }
            });
        }
        
        return parentSize;
    }

    buildNamespaceHierarchy(classes) {
        const hierarchy = {};
        
        classes.forEach(classInfo => {
            const chain = classInfo.inheritanceChain || [];
            if (chain.length === 0) {
                hierarchy[classInfo.className] = {
                    namespace: classInfo.className,
                    chain: [classInfo.className]
                };
            } else {
                hierarchy[classInfo.className] = {
                    namespace: chain.join('::'),
                    chain: chain
                };
            }
        });
        
        return hierarchy;
    }

    generateCSharpCode(collection, options) {
        const { namespaceStyle, mainNamespace } = options;
        const namespaceHierarchy = this.buildNamespaceHierarchy(collection.classes);
        
        let code = `// Generated from: ${collection.gameName} - ${collection.collectionName}\n`;
        code += `// Game Version: ${collection.gameVersion}\n`;
        code += `// Dump Date: ${collection.dumpDate}\n`;
        code += `// Generated: ${new Date().toLocaleString()}\n`;
        code += `// Relative offsets are calculated relative to each member's class\n\n`;
        
        const mainNs = this.sanitizeName(mainNamespace || 'Offsets');
        code += `namespace ${mainNs} {\n\n`;
        
        const membersByClass = {};
        collection.members.forEach(member => {
            if (!membersByClass[member.className]) {
                membersByClass[member.className] = [];
            }
            membersByClass[member.className].push(member);
        });
        
        Object.keys(membersByClass).forEach(className => {
            const members = membersByClass[className];
            
            let indentLevel = 1;
            code += `    namespace ${this.sanitizeName(className)} {\n`;
            indentLevel++;
            
            const classIndent = '    '.repeat(indentLevel);
            const memberIndent = '    '.repeat(indentLevel + 1);
            const nestedIndent = '    '.repeat(indentLevel + 2);
            
            code += `${classIndent}public static class ${this.sanitizeName(className)} {\n`;
            
            members.forEach(member => {
                const offset = member.relativeOffset || member.offset;
                code += `${nestedIndent}public const uint ${this.sanitizeName(member.memberName)} = ${this.formatOffset(offset)}; // ${member.memberType}\n`;
            });
            
            code += `${classIndent}}\n`;
            
            code += `    }\n\n`;
        });
        
        if (collection.enums && collection.enums.length > 0) {
            collection.enums.forEach(enumData => {
                code += `    // Enum: ${enumData.enumName}\n`;
                code += `    enum ${this.sanitizeName(enumData.enumName)} {\n`;
                enumData.values.forEach((value, index) => {
                    const isLast = index === enumData.values.length - 1;
                    const comma = isLast ? '' : ',';
                    code += `        ${this.sanitizeName(value.name)} = ${value.value}${comma}\n`;
                });
                code += `    }\n\n`;
            });
        }
        
        code += '}\n';
        
        return code;
    }

    generateCppCode(collection, options) {
        const { namespaceStyle, mainNamespace } = options;
        const namespaceHierarchy = this.buildNamespaceHierarchy(collection.classes);
        
        let code = `// Generated from: ${collection.gameName} - ${collection.collectionName}\n`;
        code += `// Game Version: ${collection.gameVersion}\n`;
        code += `// Dump Date: ${collection.dumpDate}\n`;
        code += `// Generated: ${new Date().toLocaleString()}\n`;
        code += `// Relative offsets are calculated relative to each member's class\n\n`;
        code += `#include <cstdint>\n\n`;
        
        const mainNs = this.sanitizeName(mainNamespace || 'Offsets');
        code += `namespace ${mainNs} {\n\n`;
        
        const membersByClass = {};
        collection.members.forEach(member => {
            if (!membersByClass[member.className]) {
                membersByClass[member.className] = [];
            }
            membersByClass[member.className].push(member);
        });
        
        Object.keys(membersByClass).forEach(className => {
            const members = membersByClass[className];
            
            let indentLevel = 1;
            code += `    namespace ${this.sanitizeName(className)} {\n`;
            indentLevel++;
            
            const classIndent = '    '.repeat(indentLevel);
            const memberIndent = '    '.repeat(indentLevel + 1);
            const nestedIndent = '    '.repeat(indentLevel + 2);
            
            code += `${classIndent}class ${this.sanitizeName(className)} {\n`;
            code += `${memberIndent}public:\n`;
            
            members.forEach(member => {
                const offset = member.relativeOffset || member.offset;
                code += `${nestedIndent}static constexpr uintptr_t ${this.sanitizeName(member.memberName)} = ${this.formatOffset(offset)}; // ${member.memberType}\n`;
            });
            
            code += `${classIndent};\n`;
            
            code += `    }\n\n`;
        });
        
        if (collection.enums && collection.enums.length > 0) {
            collection.enums.forEach(enumData => {
                code += `    // Enum: ${enumData.enumName}\n`;
                code += `    enum class ${this.sanitizeName(enumData.enumName)} : ${enumData.underlyingType || 'uint8'} {\n`;
                enumData.values.forEach((value, index) => {
                    const isLast = index === enumData.values.length - 1;
                    const comma = isLast ? '' : ',';
                    code += `        ${this.sanitizeName(value.name)} = ${value.value}${comma}\n`;
                });
                code += `    };\n\n`;
            });
        }
        
        code += '}\n';
        
        return code;
    }

    formatOffset(offset) {
        if (typeof offset === 'string' && offset.startsWith('0x')) {
            return offset;
        }
        const num = typeof offset === 'number' ? offset : parseInt(offset, 16);
        return `0x${num.toString(16)}`;
    }

    sanitizeName(name) {
        if (!name) return 'Unknown';
        let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
        if (sanitized.length === 0 || /^[0-9]/.test(sanitized)) {
            sanitized = '_' + sanitized;
        }
        return sanitized;
    }
}

window.offsetsGenerator = new OffsetsGenerator();

