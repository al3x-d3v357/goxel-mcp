#!/usr/bin/env node
/**
 * Goxel Voxel Art MCP Server
 * Conecta o Antigravity ao Goxel para geração e manipulação automatizada de Voxel Art 3D.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const readline = require('readline');

const GOXEL_BIN = process.env.GOXEL_BIN || (
  fs.existsSync('/media/alex/alex/softwares/goxel-0.15.1-extracted/AppRun')
    ? '/media/alex/alex/softwares/goxel-0.15.1-extracted/AppRun'
    : (fs.existsSync('/media/alex/alex/softwares/goxel-0.15.1.AppImage')
      ? '/media/alex/alex/softwares/goxel-0.15.1.AppImage'
      : 'goxel')
);

const DEFAULT_OUTPUT_DIR = process.env.GOXEL_OUTPUT_DIR || (
  fs.existsSync('/media/alex/alex/pro_unity/block_tactics/blocktactics/Assets/BlockTactics/VoxelCharacters')
    ? '/media/alex/alex/pro_unity/block_tactics/blocktactics/Assets/BlockTactics/VoxelCharacters'
    : path.join(process.cwd(), 'output_voxels')
);

if (!fs.existsSync(DEFAULT_OUTPUT_DIR)) {
  try { fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true }); } catch (e) {}
}

const TOOLS = [
  {
    name: 'goxel_create_character',
    description: 'Constrói um personagem em Voxel Art 3D (Arqueiro, Tanque, Mago, Suporte ou customizado) utilizando o Goxel e exporta para .vox e .obj.',
    inputSchema: {
      type: 'object',
      properties: {
        character_class: {
          type: 'string',
          enum: ['archer', 'tank', 'mage', 'support', 'elf_healer', 'cyberpunk_archer'],
          description: 'Classe do herói a ser gerado'
        },
        output_dir: {
          type: 'string',
          description: 'Diretório onde salvar os arquivos gerados (opcional)'
        },
        export_obj: {
          type: 'boolean',
          description: 'Se verdadeiro, também converte e exporta o modelo para .obj 3D'
        },
        open_in_gui: {
          type: 'boolean',
          description: 'Se verdadeiro, abre a interface gráfica do Goxel com o personagem na tela'
        }
      },
      required: ['character_class']
    }
  },
  {
    name: 'goxel_create_object',
    description: 'Constrói um objeto, arma ou item de cenário em Voxel Art 3D (espada, escudo, cajado, arco, baú, poção, tocha, pilar).',
    inputSchema: {
      type: 'object',
      properties: {
        object_type: {
          type: 'string',
          enum: ['sword', 'shield', 'staff', 'bow', 'chest', 'potion', 'torch', 'pillar'],
          description: 'Tipo de objeto a ser modelado'
        },
        output_path: {
          type: 'string',
          description: 'Caminho completo do arquivo de saída .vox'
        },
        export_obj: {
          type: 'boolean',
          description: 'Se verdadeiro, também exporta para .obj'
        },
        open_in_gui: {
          type: 'boolean',
          description: 'Se verdadeiro, abre no Goxel GUI'
        }
      },
      required: ['object_type', 'output_path']
    }
  },
  {
    name: 'goxel_run_custom_script',
    description: 'Executa um script procedural JavaScript arbitrário dentro do motor QuickJS do Goxel para esculturas voxel complexas.',
    inputSchema: {
      type: 'object',
      properties: {
        script_code: {
          type: 'string',
          description: 'Código JavaScript a ser executado dentro do Goxel (acessa goxel.image.activeLayer.volume)'
        },
        output_vox_path: {
          type: 'string',
          description: 'Caminho para salvar o volume final em .vox'
        }
      },
      required: ['script_code', 'output_vox_path']
    }
  },
  {
    name: 'goxel_export_model',
    description: 'Converte um arquivo de voxels (.vox ou .gox) para .obj, .gltf ou render .png.',
    inputSchema: {
      type: 'object',
      properties: {
        input_file: {
          type: 'string',
          description: 'Arquivo de origem (.vox ou .gox)'
        },
        output_file: {
          type: 'string',
          description: 'Arquivo de destino (.obj, .gltf ou .png)'
        }
      },
      required: ['input_file', 'output_file']
    }
  },
  {
    name: 'goxel_open_gui',
    description: 'Abre a janela gráfica do Goxel com um modelo de voxels carregado na tela.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Caminho do arquivo .vox ou .gox para visualizar no Goxel'
        }
      },
      required: ['file_path']
    }
  }
];

function getVoxelHelpers() {
  return `
function setBox(vol, x1, y1, z1, x2, y2, z2, color) {
  let minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  let minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  let minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        vol.setAt([x, y, z], color);
      }
    }
  }
}
`;
}

function handleCreateCharacter(args) {
  const charClass = args.character_class;
  const outDir = args.output_dir || DEFAULT_OUTPUT_DIR;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const voxPath = path.join(outDir, `${charClass}.vox`);
  const objPath = path.join(outDir, `${charClass}.obj`);

  let buildCode = '';
  if (charClass === 'archer') {
    buildCode = `
      const C_SKIN = [235, 195, 160, 255];
      const C_TUNIC = [45, 135, 55, 255];
      const C_TUNIC_DARK = [32, 100, 40, 255];
      const C_LEATHER = [105, 60, 30, 255];
      const C_LEATHER_DARK = [70, 40, 20, 255];
      const C_GOLD = [255, 205, 40, 255];
      const C_HAIR = [140, 75, 30, 255];
      const C_FEATHER = [255, 60, 60, 255];
      const C_BOW = [90, 50, 25, 255];
      const C_STRING = [230, 230, 230, 255];

      // Botas e Pernas
      setBox(vol, -3, -2, 0, -1, 2, 2, C_LEATHER_DARK);
      setBox(vol, 1, -2, 0, 3, 2, 2, C_LEATHER_DARK);
      setBox(vol, -3, -2, 3, -1, 1, 9, C_TUNIC_DARK);
      setBox(vol, 1, -2, 3, 3, 1, 9, C_TUNIC_DARK);

      // Túnica e Cinto
      setBox(vol, -4, -2, 10, 4, 2, 17, C_TUNIC);
      setBox(vol, -4, -3, 10, 4, 3, 11, C_LEATHER);
      setBox(vol, -1, 3, 10, 1, 3, 11, C_GOLD);

      // Cabeça, Cabelo e Rosto
      setBox(vol, -3, -3, 18, 3, 3, 24, C_SKIN);
      setBox(vol, -4, -4, 20, 4, -3, 25, C_HAIR);
      vol.setAt([-1, 3, 21], [30, 110, 180, 255]);
      vol.setAt([1, 3, 21], [30, 110, 180, 255]);

      // Chapéu e Pena
      setBox(vol, -4, -4, 25, 4, 4, 25, C_TUNIC_DARK);
      setBox(vol, -3, -4, 26, 3, 2, 26, C_TUNIC);
      setBox(vol, -2, -3, 27, 2, 0, 27, C_TUNIC);
      setBox(vol, -4, 0, 26, -4, 1, 29, C_FEATHER);

      // Braços e Arco
      setBox(vol, 4, -1, 14, 6, 1, 17, C_TUNIC);
      setBox(vol, 5, -1, 10, 6, 1, 13, C_SKIN);
      setBox(vol, -6, -1, 14, -4, 1, 17, C_TUNIC);
      setBox(vol, -6, 0, 12, -5, 3, 14, C_SKIN);

      for (let z = 5; z <= 22; z++) vol.setAt([-6, 4, z], C_BOW);
      vol.setAt([-6, 3, 23], C_BOW);
      vol.setAt([-6, 3, 4], C_BOW);
      for (let z = 4; z <= 23; z++) vol.setAt([-6, 2, z], C_STRING);
    `;
  } else if (charClass === 'tank') {
    buildCode = `
      const C_STEEL = [65, 85, 115, 255];
      const C_STEEL_DARK = [40, 55, 75, 255];
      const C_GOLD = [225, 185, 45, 255];
      const C_CYAN = [45, 220, 255, 255];
      const C_DARK = [30, 35, 45, 255];

      // Botas e Pernas
      setBox(vol, -4, -3, 0, -1, 3, 3, C_STEEL_DARK);
      setBox(vol, 1, -3, 0, 4, 3, 3, C_STEEL_DARK);
      setBox(vol, -4, -2, 4, -1, 2, 9, C_STEEL);
      setBox(vol, 1, -2, 4, 4, 2, 9, C_STEEL);

      // Peitoral Maciço e Ombreiras
      setBox(vol, -5, -3, 10, 5, 3, 18, C_STEEL);
      setBox(vol, -4, 4, 12, 4, 4, 17, C_STEEL_DARK);
      setBox(vol, -1, 4, 14, 1, 4, 16, C_GOLD);
      setBox(vol, -7, -3, 15, -4, 3, 20, C_GOLD);
      setBox(vol, 4, -3, 15, 7, 3, 20, C_GOLD);

      // Elmo Fechado com Visor Luminoso
      setBox(vol, -4, -4, 18, 4, 4, 25, C_STEEL);
      setBox(vol, -3, -4, 26, 3, 4, 27, C_STEEL_DARK);
      setBox(vol, -3, 4, 21, 3, 4, 22, C_CYAN);

      // Escudo Torre
      setBox(vol, -8, -1, 4, -8, 7, 21, C_STEEL_DARK);
      setBox(vol, -9, -1, 4, -9, 7, 5, C_GOLD);
      setBox(vol, -9, -1, 20, -9, 7, 21, C_GOLD);
      setBox(vol, -9, 2, 9, -9, 4, 17, C_GOLD);

      // Espada
      setBox(vol, 6, 3, 8, 6, 4, 11, C_DARK);
      setBox(vol, 5, 3, 12, 7, 4, 12, C_GOLD);
      setBox(vol, 6, 3, 13, 6, 4, 24, [200, 215, 230, 255]);
    `;
  } else if (charClass === 'mage') {
    buildCode = `
      const C_ROBE = [85, 35, 140, 255];
      const C_ROBE_DARK = [55, 20, 95, 255];
      const C_GOLD = [250, 195, 45, 255];
      const C_CRYSTAL = [215, 55, 255, 255];
      const C_SKIN = [235, 195, 160, 255];
      const C_BEARD = [220, 220, 230, 255];

      // Túnica Longa
      setBox(vol, -4, -3, 0, 4, 3, 2, C_GOLD);
      setBox(vol, -4, -3, 3, 4, 3, 9, C_ROBE_DARK);
      setBox(vol, -4, -3, 10, 4, 3, 17, C_ROBE);
      setBox(vol, -1, 3, 3, 1, 3, 17, C_GOLD);

      // Cabeça, Barba e Chapéu
      setBox(vol, -3, -3, 18, 3, 3, 24, C_SKIN);
      setBox(vol, -3, 3, 17, 3, 4, 21, C_BEARD);
      vol.setAt([-1, 3, 22], C_CRYSTAL);
      vol.setAt([1, 3, 22], C_CRYSTAL);

      setBox(vol, -5, -5, 25, 5, 5, 25, C_ROBE_DARK);
      setBox(vol, -3, -3, 26, 3, 3, 27, C_ROBE);
      setBox(vol, -2, -2, 28, 2, 2, 29, C_ROBE);
      setBox(vol, -1, -2, 30, 1, 0, 31, C_ROBE);
      vol.setAt([0, -2, 32], C_GOLD);

      // Cajado com Cristal
      for (let z = 0; z <= 24; z++) vol.setAt([6, 2, z], [75, 45, 25, 255]);
      setBox(vol, 5, 1, 24, 7, 3, 25, C_GOLD);
      setBox(vol, 5, 1, 26, 7, 3, 28, C_CRYSTAL);
    `;
  } else if (charClass === 'support') {
    buildCode = `
      const C_WHITE = [240, 240, 245, 255];
      const C_GOLD = [255, 215, 50, 255];
      const C_CYAN = [75, 225, 235, 255];
      const C_SKIN = [235, 195, 160, 255];

      // Vestes Sagradas
      setBox(vol, -4, -3, 0, 4, 3, 2, C_GOLD);
      setBox(vol, -4, -3, 3, 4, 3, 17, C_WHITE);
      setBox(vol, -2, 3, 5, -1, 3, 17, C_GOLD);
      setBox(vol, 1, 3, 5, 2, 3, 17, C_GOLD);

      // Cabeça e Auréola
      setBox(vol, -3, -3, 18, 3, 3, 24, C_SKIN);
      vol.setAt([-1, 3, 21], C_CYAN);
      vol.setAt([1, 3, 21], C_CYAN);

      for (let x = -3; x <= 3; x++) {
        vol.setAt([x, -3, 28], C_GOLD);
        vol.setAt([x, 3, 28], C_GOLD);
      }
      for (let y = -2; y <= 2; y++) {
        vol.setAt([-3, y, 28], C_GOLD);
        vol.setAt([3, y, 28], C_GOLD);
      }

      // Cetro de Luz Divina
      for (let z = 4; z <= 20; z++) vol.setAt([6, 2, z], C_GOLD);
      setBox(vol, 5, 1, 22, 7, 3, 24, C_CYAN);
    `;
  } else if (charClass === 'elf_healer') {
    buildCode = `
      const C_SKIN = [245, 215, 185, 255];
      const C_HAIR = [225, 230, 240, 255];
      const C_EYE_GREEN = [40, 215, 140, 255];
      const C_EYE_WHITE = [250, 250, 255, 255];
      const C_ROBE_WHITE = [245, 248, 250, 255];
      const C_ROBE_EMERALD = [35, 155, 95, 255];
      const C_ROBE_MINT = [95, 215, 160, 255];
      const C_SILVER = [190, 205, 215, 255];
      const C_GOLD_LEAF = [245, 210, 60, 255];
      const C_WOOD_LIVING = [105, 65, 35, 255];
      const C_HEAL_GLOW = [60, 255, 160, 255];
      const C_HEAL_SPARKLE = [180, 255, 220, 255];

      // Botas Élficas com pontas curvadas
      setBox(vol, -3, -2, 0, -1, 2, 2, [80, 50, 30, 255]);
      setBox(vol, 1, -2, 0, 3, 2, 2, [80, 50, 30, 255]);
      vol.setAt([-2, 4, 1], C_ROBE_MINT);
      vol.setAt([2, 4, 1], C_ROBE_MINT);

      // Túnica e Corpete
      setBox(vol, -4, -3, 1, 4, 3, 2, C_SILVER);
      setBox(vol, -4, -3, 3, 4, 3, 9, C_ROBE_WHITE);
      setBox(vol, -2, 3, 2, 2, 3, 9, C_ROBE_EMERALD);
      setBox(vol, -4, -2, 10, 4, 2, 17, C_ROBE_WHITE);
      setBox(vol, -4, -3, 10, 4, 3, 11, C_SILVER);
      setBox(vol, -1, 3, 10, 1, 3, 11, C_GOLD_LEAF);
      vol.setAt([0, 3, 10], C_HEAL_GLOW);
      setBox(vol, -3, 2, 12, 3, 2, 16, C_ROBE_EMERALD);

      // Cabeça e Orelhas Élficas Longas
      setBox(vol, -3, -3, 18, 3, 3, 24, C_SKIN);
      // Orelha Esquerda
      setBox(vol, -4, -1, 21, -4, 1, 23, C_SKIN);
      setBox(vol, -5, -2, 22, -5, 0, 24, C_SKIN);
      setBox(vol, -6, -3, 23, -6, -1, 25, C_SKIN);
      vol.setAt([-7, -4, 25], C_SKIN);
      vol.setAt([-7, -4, 26], C_ROBE_MINT);
      // Orelha Direita
      setBox(vol, 4, -1, 21, 4, 1, 23, C_SKIN);
      setBox(vol, 5, -2, 22, 5, 0, 24, C_SKIN);
      setBox(vol, 6, -3, 23, 6, -1, 25, C_SKIN);
      vol.setAt([7, -4, 25], C_SKIN);
      vol.setAt([7, -4, 26], C_ROBE_MINT);

      // Cabelo Prateado Longo e Diadema
      setBox(vol, -4, -4, 12, 4, -3, 25, C_HAIR);
      setBox(vol, -3, -3, 25, 3, 2, 26, C_HAIR);
      for (let x = -3; x <= 3; x++) vol.setAt([x, 3, 24], C_SILVER);
      vol.setAt([0, 4, 24], C_HEAL_GLOW);

      // Olhos Verde Esmeralda
      vol.setAt([-2, 3, 21], C_EYE_WHITE);
      vol.setAt([-1, 3, 21], C_EYE_GREEN);
      vol.setAt([2, 3, 21], C_EYE_WHITE);
      vol.setAt([1, 3, 21], C_EYE_GREEN);

      // Asas de Espírito da Floresta
      setBox(vol, -6, -4, 16, -4, -4, 21, C_HEAL_SPARKLE);
      setBox(vol, -7, -5, 18, -5, -4, 22, C_HEAL_GLOW);
      setBox(vol, 4, -4, 16, 6, -4, 21, C_HEAL_SPARKLE);
      setBox(vol, 5, -5, 18, 7, -4, 22, C_HEAL_GLOW);

      // Cajado da Árvore da Vida com Flor de Cura
      setBox(vol, 4, -1, 14, 5, 2, 17, C_ROBE_WHITE);
      for (let z = 0; z <= 22; z++) vol.setAt([6, 2, z], C_WOOD_LIVING);
      vol.setAt([6, 3, 6], C_ROBE_EMERALD);
      vol.setAt([5, 2, 10], C_ROBE_MINT);
      setBox(vol, 5, 1, 24, 7, 3, 26, C_HEAL_GLOW);
      vol.setAt([6, 2, 27], C_HEAL_SPARKLE);
      vol.setAt([6, 2, 28], C_HEAL_GLOW);

      // Orbe de Cura na Mão Esquerda
      setBox(vol, -5, -1, 14, -4, 2, 17, C_ROBE_WHITE);
      setBox(vol, -6, 2, 13, -5, 4, 15, C_SKIN);
      setBox(vol, -7, 3, 16, -5, 5, 18, C_HEAL_GLOW);
      vol.setAt([-6, 4, 19], C_HEAL_SPARKLE);
    `;
  } else if (charClass === 'cyberpunk_archer') {
    buildCode = `
      const C_CARBON = [24, 27, 36, 255];
      const C_CARBON_LIGHT = [45, 50, 65, 255];
      const C_ORANGE = [255, 115, 0, 255];
      const C_ORANGE_GLOW = [255, 160, 40, 255];
      const C_CYBER_BLUE = [20, 60, 160, 255];
      const C_CYAN = [0, 225, 255, 255];
      const C_CYAN_GLOW = [120, 245, 255, 255];
      const C_SKIN = [235, 195, 160, 255];
      const C_HAIR = [30, 32, 42, 255];
      const C_STEEL = [110, 120, 135, 255];

      // Botas Taticas com Solado Neon Laranja
      setBox(vol, -3, -2, 0, -1, 2, 0, C_ORANGE);
      setBox(vol, 1, -2, 0, 3, 2, 0, C_ORANGE);
      setBox(vol, -3, -2, 1, -1, 2, 3, C_CARBON);
      setBox(vol, 1, -2, 1, 3, 2, 3, C_CARBON);

      // Pernas / Calcas de Combate Azul Cibernetico com Joelheiras Ciano
      setBox(vol, -3, -2, 4, -1, 1, 9, C_CYBER_BLUE);
      setBox(vol, 1, -2, 4, 3, 1, 9, C_CYBER_BLUE);
      vol.setAt([-2, 2, 6], C_CYAN);
      vol.setAt([2, 2, 6], C_CYAN);

      // Colete / Jaqueta Cibernetica Carbono com Faixas Laranja e Nucleo Ciano
      setBox(vol, -4, -2, 10, 4, 2, 17, C_CARBON);
      setBox(vol, -4, -3, 10, 4, -3, 11, C_ORANGE);
      setBox(vol, -4, 3, 10, 4, 3, 11, C_ORANGE);
      vol.setAt([-4, -2, 15], C_ORANGE);
      vol.setAt([4, -2, 15], C_ORANGE);
      // Reator / Nucleo Peitoral
      setBox(vol, -1, 3, 13, 1, 3, 15, C_CYAN);
      vol.setAt([0, 3, 14], C_CYAN_GLOW);

      // Mochila de Bateria / Quiver Tatico nas Costas
      setBox(vol, -3, -4, 11, 3, -3, 17, C_CARBON_LIGHT);
      vol.setAt([-2, -4, 13], C_ORANGE);
      vol.setAt([0, -4, 13], C_ORANGE);
      vol.setAt([2, -4, 13], C_ORANGE);
      vol.setAt([-2, -4, 16], C_CYAN);
      vol.setAt([2, -4, 16], C_CYAN);

      // Cabeca, Rosto e Cyber Visor
      setBox(vol, -3, -3, 18, 3, 3, 24, C_SKIN);
      // Visor Holografico Neon Azul/Ciano nos Olhos
      setBox(vol, -3, 4, 21, 3, 4, 22, C_CYAN);
      vol.setAt([2, 4, 22], C_ORANGE);

      // Cabelo Cyberpunk com Pontas Spiky Laranja
      setBox(vol, -4, -4, 20, 4, -3, 25, C_HAIR);
      setBox(vol, -3, -3, 25, 3, 3, 26, C_HAIR);
      vol.setAt([-2, 1, 27], C_ORANGE);
      vol.setAt([0, 2, 27], C_ORANGE_GLOW);
      vol.setAt([2, 1, 27], C_ORANGE);
      vol.setAt([-1, -1, 27], C_ORANGE);
      vol.setAt([1, -1, 27], C_ORANGE);

      // Braco Direito (Humano com Manopla de Tiro)
      setBox(vol, 4, -1, 14, 6, 1, 17, C_CYBER_BLUE);
      setBox(vol, 5, -1, 11, 6, 1, 13, C_SKIN);
      setBox(vol, 5, 0, 9, 6, 2, 11, C_CARBON);
      vol.setAt([6, 1, 10], C_ORANGE);

      // Braco Esquerdo (Protese Cibernetica Total em Aco/Ciano segurando o Arco)
      setBox(vol, -6, -1, 14, -4, 1, 17, C_STEEL);
      setBox(vol, -6, -1, 11, -5, 1, 13, C_CARBON_LIGHT);
      vol.setAt([-6, 0, 12], C_CYAN);
      setBox(vol, -6, 0, 9, -5, 3, 11, C_STEEL);

      // Arco Composto Cyberpunk (Frame Carbono + Acentos Laranja + Laser Cord Ciano)
      for (let z = 3; z <= 24; z++) vol.setAt([-6, 4, z], C_CARBON);
      setBox(vol, -6, 4, 22, -6, 5, 24, C_ORANGE);
      setBox(vol, -6, 4, 3, -6, 5, 5, C_ORANGE);
      vol.setAt([-6, 6, 23], C_CYAN);
      vol.setAt([-6, 6, 4], C_CYAN);
      vol.setAt([-6, 3, 14], C_ORANGE);
      vol.setAt([-6, 2, 14], C_CYAN);
      for (let z = 5; z <= 22; z++) vol.setAt([-6, 2, z], C_CYAN);
    `;
  }

  const scriptContent = `
    ${getVoxelHelpers()}
    let vol = goxel.image.activeLayer.volume;
    ${buildCode}
    vol.save("${voxPath}");
  `;

  const tmpScript = path.join('/tmp', `goxel_gen_${Date.now()}.js`);
  fs.writeFileSync(tmpScript, scriptContent, 'utf-8');

  try {
    execSync(`${GOXEL_BIN} --script=${tmpScript}`, { stdio: 'pipe' });
  } finally {
    try { fs.unlinkSync(tmpScript); } catch (e) {}
  }

  let exportedObj = false;
  if (args.export_obj !== false) {
    try {
      execSync(`${GOXEL_BIN} "${voxPath}" -e "${objPath}"`, { stdio: 'pipe' });
      exportedObj = true;
    } catch (e) {}
  }

  if (args.open_in_gui) {
    spawn(GOXEL_BIN, [voxPath], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
    }).unref();
  }

  return {
    success: true,
    character_class: charClass,
    vox_path: voxPath,
    obj_path: exportedObj ? objPath : null,
    opened_in_gui: !!args.open_in_gui
  };
}

function handleCreateObject(args) {
  const type = args.object_type;
  const outPath = args.output_path;
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let buildCode = '';
  if (type === 'sword') {
    buildCode = `
      setBox(vol, -1, -1, 0, 1, 1, 4, [60, 40, 20, 255]);
      setBox(vol, -4, -1, 5, 4, 1, 6, [240, 190, 40, 255]);
      setBox(vol, -2, -1, 7, 2, 1, 22, [210, 225, 240, 255]);
      vol.setAt([0, 0, 23], [210, 225, 240, 255]);
    `;
  } else if (type === 'chest') {
    buildCode = `
      setBox(vol, -6, -4, 0, 6, 4, 8, [110, 65, 30, 255]);
      setBox(vol, -6, -4, 0, 6, -4, 8, [60, 60, 65, 255]);
      setBox(vol, -6, 4, 0, 6, 4, 8, [60, 60, 65, 255]);
      setBox(vol, -1, 4, 4, 1, 5, 6, [255, 215, 50, 255]);
    `;
  } else if (type === 'potion') {
    buildCode = `
      setBox(vol, -3, -3, 0, 3, 3, 6, [255, 40, 80, 255]);
      setBox(vol, -1, -1, 7, 1, 1, 9, [230, 240, 255, 180]);
      setBox(vol, -2, -2, 10, 2, 2, 11, [140, 85, 45, 255]);
    `;
  } else {
    buildCode = `
      setBox(vol, -4, -4, 0, 4, 4, 16, [140, 140, 150, 255]);
    `;
  }

  const scriptContent = `
    ${getVoxelHelpers()}
    let vol = goxel.image.activeLayer.volume;
    ${buildCode}
    vol.save("${outPath}");
  `;

  const tmpScript = path.join('/tmp', `goxel_obj_${Date.now()}.js`);
  fs.writeFileSync(tmpScript, scriptContent, 'utf-8');

  try {
    execSync(`${GOXEL_BIN} --script=${tmpScript}`, { stdio: 'pipe' });
  } finally {
    try { fs.unlinkSync(tmpScript); } catch (e) {}
  }

  let objPath = null;
  if (args.export_obj) {
    objPath = outPath.replace(/\\.vox$/i, '.obj');
    try {
      execSync(`${GOXEL_BIN} "${outPath}" -e "${objPath}"`, { stdio: 'pipe' });
    } catch (e) {}
  }

  if (args.open_in_gui) {
    spawn(GOXEL_BIN, [outPath], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
    }).unref();
  }

  return { success: true, vox_path: outPath, obj_path: objPath };
}

function handleExport(args) {
  execSync(`${GOXEL_BIN} "${args.input_file}" -e "${args.output_file}"`, { stdio: 'pipe' });
  return { success: true, output_file: args.output_file };
}

function handleOpenGui(args) {
  const child = spawn(GOXEL_BIN, [args.file_path], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
  });
  child.unref();
  return { success: true, pid: child.pid, file_path: args.file_path };
}

// JSON-RPC 2.0 Loop
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    const id = req.id;
    const method = req.method;

    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'goxel-mcp-server', version: '1.0.0' }
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } else if (method === 'notifications/initialized') {
      // Acknowledgement
    } else if (method === 'ping') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id, result: {} }) + '\n');
    } else if (method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: { tools: TOOLS }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } else if (method === 'tools/call') {
      const toolName = req.params.name;
      const args = req.params.arguments || {};
      let result;

      try {
        if (toolName === 'goxel_create_character') {
          result = handleCreateCharacter(args);
        } else if (toolName === 'goxel_create_object') {
          result = handleCreateObject(args);
        } else if (toolName === 'goxel_export_model') {
          result = handleExport(args);
        } else if (toolName === 'goxel_open_gui') {
          result = handleOpenGui(args);
        } else if (toolName === 'goxel_run_custom_script') {
          const scriptContent = `
            ${getVoxelHelpers()}
            let vol = goxel.image.activeLayer.volume;
            ${args.script_code}
            vol.save("${args.output_vox_path}");
          `;
          const tmpScript = path.join('/tmp', `goxel_custom_${Date.now()}.js`);
          fs.writeFileSync(tmpScript, scriptContent, 'utf-8');
          try {
            execSync(`${GOXEL_BIN} --script=${tmpScript}`, { stdio: 'pipe' });
            result = { success: true, output_path: args.output_vox_path };
          } finally {
            try { fs.unlinkSync(tmpScript); } catch (e) {}
          }
        } else {
          throw new Error(`Tool not found: ${toolName}`);
        }

        const response = {
          jsonrpc: '2.0',
          id: id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (err) {
        const response = {
          jsonrpc: '2.0',
          id: id,
          error: { code: -32000, message: err.message }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    }
  } catch (err) {}
});
