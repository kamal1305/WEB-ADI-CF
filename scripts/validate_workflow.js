const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = path.join(__dirname, '..', 'n8n-prensa-y-socialmedia.json');
const raw = fs.readFileSync(filePath);

// Comprobar BOM
if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
  throw new Error('El archivo tiene UTF-8 BOM!');
}

const workflow = JSON.parse(raw.toString('utf8'));
console.log('✓ JSON sintácticamente válido.');
console.log('Nombre:', workflow.name);

// Validar nodos únicos
const nodeNames = new Set();
const nodeIds = new Set();

workflow.nodes.forEach(node => {
  if (nodeNames.has(node.name)) {
    throw new Error('Nombre de nodo duplicado: ' + node.name);
  }
  nodeNames.add(node.name);

  if (nodeIds.has(node.id)) {
    throw new Error('ID de nodo duplicado: ' + node.id);
  }
  nodeIds.add(node.id);

  // Validar sintaxis JS en nodos de código (n8n los ejecuta dentro de una función envolvente)
  if (node.type === 'n8n-nodes-base.code' && node.parameters && node.parameters.jsCode) {
    try {
      new vm.Script('(function() {\n' + node.parameters.jsCode + '\n})');
      console.log('✓ Código JS válido en nodo:', node.name);
    } catch (e) {
      throw new Error('Error sintáctico en nodo ' + node.name + ': ' + e.message);
    }
  }
});

console.log('✓ Todos los', nodeNames.size, 'nodos tienen nombres e IDs únicos.');

// Validar conexiones
Object.keys(workflow.connections).forEach(sourceName => {
  if (!nodeNames.has(sourceName)) {
    throw new Error('Conexión desde nodo desconocido: ' + sourceName);
  }
  const outputs = workflow.connections[sourceName];
  Object.keys(outputs).forEach(outType => {
    const targetGroups = outputs[outType];
    targetGroups.forEach((group, gIdx) => {
      group.forEach((conn, cIdx) => {
        if (!nodeNames.has(conn.node)) {
          throw new Error('Conexión hacia nodo inexistente: ' + conn.node + ' desde ' + sourceName);
        }
      });
    });
  });
});

console.log('✓ Conexiones 100% íntegras y verificadas.');
console.log('✓ Todas las comprobaciones de n8n v1 han superado la validación formal.');
