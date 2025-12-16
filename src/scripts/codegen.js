class CodeGenerator {
    constructor() {
        this.typeMap = {
            'D': 'int32',
            'float': 'float',
            'double': 'double',
            'bool': 'bool',
            'uint8': 'uint8',
            'uint16': 'uint16',
            'uint32': 'uint32',
            'int8': 'int8',
            'int16': 'int16',
            'int32': 'int32',
            'int64': 'int64'
        };
    }

    generateCode(item) {
        const codeElement = document.getElementById('generatedCode');
        if (!codeElement) return;

        const itemType = item.type || item.searchType;
        
        if (itemType !== 'class' && itemType !== 'classes' && itemType !== 'struct' && itemType !== 'structs') {
            codeElement.textContent = '// Code generation only available for classes and structs';
            return;
        }

        const namespace = item.name || item.className || 'Unknown';
        const inheritance = window.inheritanceViewer.getInheritanceInfo(item);
        const members = this.extractMembers(item);

        let code = '';

        if (inheritance && inheritance.length > 0) {
            const baseClass = inheritance[inheritance.length - 1];
            code += `// Inheritance: ${baseClass}\n`;
        }

        code += `namespace ${namespace} {\n`;

        members.forEach(member => {
            const offsetHex = '0x' + member.offset.toString(16);
            const typeStr = this.formatTypeForCode(member.typeInfo);
            code += `\tconstexpr auto ${member.name} = ${offsetHex}; // ${typeStr}\n`;
        });

        code += '}';

        const codeInner = codeElement.querySelector('code');
        if (codeInner) {
            codeInner.innerHTML = this.highlightCode(code);
        } else {
            codeElement.innerHTML = `<code>${this.highlightCode(code)}</code>`;
        }

        if (window.app && window.app.makeTypeClickable) {
            const codeContainer = codeElement.querySelector('code') || codeElement;
            if (codeContainer) {
                const commentSpans = codeContainer.querySelectorAll('.comment');
                commentSpans.forEach(span => {
                    const originalText = span.textContent;
                    const clickableText = window.app.makeTypeClickable(originalText);
                    if (clickableText !== originalText) {
                        span.innerHTML = clickableText;
                    }
                });
                window.app.setupTypeLinkHandlers(codeContainer);
            }
        }

        document.getElementById('copyCodeBtn').style.display = 'block';
    }
    
    highlightCode(code) {
        let highlighted = '';
        let i = 0;
        const len = code.length;
        
        while (i < len) {
            if (code[i] === '#' && (i === 0 || code[i - 1] === '\n' || /\s/.test(code[i - 1]))) {
                const preprocessorEnd = code.indexOf('\n', i);
                const preprocessor = preprocessorEnd === -1 ? code.substring(i) : code.substring(i, preprocessorEnd);
                const directiveMatch = preprocessor.match(/^#(\w+)(.*)/);
                if (directiveMatch) {
                    const directive = directiveMatch[1];
                    let rest = directiveMatch[2];
                    
                    if (directive === 'include') {
                        const headerMatch = rest.match(/^(\s*)(<[^>]+>|"[^"]+")/);
                        if (headerMatch) {
                            const whitespace = headerMatch[1];
                            const header = headerMatch[2];
                            const afterHeader = rest.substring(headerMatch[0].length);
                            highlighted += `<span class="preprocessor">#${this.escapeHtml(directive)}</span>${this.escapeHtml(whitespace)}<span class="string">${this.escapeHtml(header)}</span>${this.escapeHtml(afterHeader)}`;
                        } else {
                            highlighted += `<span class="preprocessor">#${this.escapeHtml(directive)}</span>${this.escapeHtml(rest)}`;
                        }
                    } else {
                        highlighted += `<span class="preprocessor">#${this.escapeHtml(directive)}</span>${this.escapeHtml(rest)}`;
                    }
                } else {
                    highlighted += `<span class="preprocessor">${this.escapeHtml(preprocessor)}</span>`;
                }
                i = preprocessorEnd === -1 ? len : preprocessorEnd;
                continue;
            }
            
            if (i < len - 1 && code[i] === '/' && code[i + 1] === '/') {
                const commentEnd = code.indexOf('\n', i);
                const comment = commentEnd === -1 ? code.substring(i) : code.substring(i, commentEnd);
                highlighted += `<span class="comment">${this.escapeHtml(comment)}</span>`;
                i = commentEnd === -1 ? len : commentEnd;
                continue;
            }
            
            const numberMatch = code.substring(i).match(/^(0x[0-9a-fA-F]+|\d+)/i);
            if (numberMatch && /[\s;=,()]/.test(code[i - 1] || ' ') && /[\s;=,()]/.test(code[i + numberMatch[0].length] || ' ')) {
                highlighted += `<span class="number">${this.escapeHtml(numberMatch[0])}</span>`;
                i += numberMatch[0].length;
                continue;
            }
            
            const wordMatch = code.substring(i).match(/^(\w+)/);
            if (wordMatch) {
                const word = wordMatch[0];
                const escapedWord = this.escapeHtml(word);
                
                const keywords = ['namespace', 'constexpr', 'auto', 'const', 'static', 'class', 'struct', 'enum', 'public', 'private', 'protected', 'virtual', 'override', 'final', 'using', 'typedef', 'template', 'typename'];
                if (keywords.includes(word)) {
                    highlighted += `<span class="keyword">${escapedWord}</span>`;
                }
                else {
                    const types = ['int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'float', 'double', 'bool', 'void', 'char', 'int', 'long', 'short', 'FName', 'TArray', 'uintptr_t', 'size_t', 'intptr_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'std::string', 'std::vector', 'std::map', 'std::unordered_map', 'string', 'wstring'];
                    if (types.includes(word)) {
                        highlighted += `<span class="type">${escapedWord}</span>`;
                    }
                    else if (i > 0) {
                        const beforeContext = code.substring(Math.max(0, i - 30), i);
                        const afterContext = code.substring(i + word.length, Math.min(len, i + word.length + 20));
                        if (afterContext.match(/^\s*=\s*\d+/)) {
                            highlighted += `<span class="enum-value">${escapedWord}</span>`;
                        }
                        else if (beforeContext.match(/\b(class|struct|enum\s+class)\s+$/)) {
                            highlighted += `<span class="class-name">${escapedWord}</span>`;
                        }
                        else if (beforeContext.match(/\bnamespace\s+$/)) {
                            highlighted += `<span class="namespace">${escapedWord}</span>`;
                        }
                        else if (beforeContext.match(/\b(static\s+)?(constexpr\s+)?(uintptr_t|size_t|intptr_t|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|int32|int64|uint8|uint16|uint32|uint64|float|double|bool|void|char|int|long|short|FName|TArray)\s+$/)) {
                            highlighted += escapedWord;
                        }
                        else if (beforeContext.match(/[:=]\s*$/)) {
                            highlighted += `<span class="type">${escapedWord}</span>`;
                        }
                        else {
                            highlighted += escapedWord;
                        }
                    }
                    else {
                        highlighted += escapedWord;
                    }
                }
                i += word.length;
                continue;
            }
            
            highlighted += this.escapeHtml(code[i]);
            i++;
        }
        
        return highlighted;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    extractMembers(item) {
        const members = [];

        if (!item.data || !Array.isArray(item.data)) {
            return members;
        }

        for (const member of item.data) {
            if (typeof member === 'object' && member !== null) {
                const entries = Object.entries(member);
                for (const [memberName, memberData] of entries) {
                    if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                        continue;
                    }

                    if (Array.isArray(memberData) && memberData.length >= 2) {
                        const offset = memberData[1];
                        const typeInfo = memberData[0];

                        members.push({
                            name: memberName,
                            offset: offset,
                            typeInfo: typeInfo
                        });
                    }
                }
            }
        }

        members.sort((a, b) => a.offset - b.offset);

        return members;
    }

    formatTypeForCode(typeArray) {
        if (!Array.isArray(typeArray) || typeArray.length === 0) {
            return 'Unknown';
        }

        const typeName = typeArray[0];
        const typeCategory = typeArray[1] || '';
        const typeModifier = typeArray[2] || '';
        const typeParams = typeArray[3] || [];

        let formatted = typeName;

        if (typeCategory === 'C' || typeCategory === 'S') {
        } else if (typeCategory === 'E') {
            formatted = typeName;
        } else if (typeCategory === 'D') {
            formatted = this.typeMap[typeName] || typeName;
        }

        if (typeModifier === '*' || typeCategory === '*') {
            formatted += '*';
        }

        if (Array.isArray(typeParams) && typeParams.length > 0) {
            const paramType = typeParams[0];
            if (Array.isArray(paramType)) {
                const innerType = this.formatTypeForCode(paramType);
                formatted = `TArray<${innerType}>`;
            } else {
                let innerType = paramType;
                if (typeParams.length > 1 && typeParams[1] === '*') {
                    innerType += '*';
                }
                formatted = `TArray<${innerType}>`;
            }
        }

        return formatted;
    }

    formatOffset(offset) {
        if (typeof offset === 'number') {
            return '0x' + offset.toString(16);
        }
        return offset;
    }

    generateEnumCode(item) {
        const codeElement = document.getElementById('generatedCode');
        if (!codeElement) return;

        const code = this.generateEnumCodeForDisplay(item);
        
        const codeInner = codeElement.querySelector('code');
        if (codeInner) {
            codeInner.innerHTML = this.highlightCode(code);
        } else {
            codeElement.innerHTML = `<code>${this.highlightCode(code)}</code>`;
        }
    }

    generateEnumCodeForDisplay(item) {
        const itemType = item.type || item.searchType;
        
        if (itemType !== 'enum') {
            return '// No enum data available';
        }

        if (!item.data || !Array.isArray(item.data) || item.data.length < 1) {
            return '// No enum data available';
        }

        const enumValues = item.data[0];
        const underlyingType = item.data[1] || 'uint8';
        const enumName = item.name || 'Unknown';

        let code = `enum class ${enumName} : ${underlyingType} {\n`;

        if (Array.isArray(enumValues)) {
            enumValues.forEach((enumValue, index) => {
                const entries = Object.entries(enumValue);
                entries.forEach(([name, value]) => {
                    const isLast = index === enumValues.length - 1;
                    const comma = isLast ? '' : ',';
                    code += `    ${name} = ${value}${comma}\n`;
                });
            });
        }

        code += '};';

        return code;
    }
}

window.codeGenerator = new CodeGenerator();

