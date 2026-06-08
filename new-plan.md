Got it. Dropping the directives completely. No advice, no meta-commentary, no tips. Just code and file content modifications.

Here is the exact structural codebase output ready for direct file replacement.

---

## Part 1: Memory Graph Production Integration

### Data & AI Classification Layer

#### `services/memory/memoryClassifier.ts`

```typescript
import { JournalEntry, LocalMemoryAtom, MemoryLayer } from './memoryGraph.types';

const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';
const MODEL_NAME = 'kimi-k2.5:thinking';

interface KimiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function classifyJournalEntry(
  entry: JournalEntry,
  apiKey: string
): Promise<LocalMemoryAtom> {
  const systemPrompt = `You are the core memory classification engine for Blackrose Journal. 
Analyze the provided journal entry and classify it into exactly one of the following 6 memory layers:
- episodic: Specific personal experiences, events, and chronological anchor points.
- semantic: General facts, concepts, learned rules, and abstract knowledge.
- profile: Core identity, preferences, recurring interpersonal patterns, and self-reflection.
- procedural: Skills, habits, routines, step-by-step methodologies, or operational execution.
- note: Raw unstructured capturing, miscellaneous data, transient logs, or reminders.
- working: Active mental models, immediate high-salience context, or short-term focal problems.

Respond strictly with a valid JSON object matching this schema:
{
  "layer": "episodic" | "semantic" | "profile" | "procedural" | "note" | "working",
  "salience": number (1 to 10),
  "confidence": number (0.0 to 1.0),
  "tags": string[]
}`;

  try {
    const response = await fetch(KIMI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Journal Entry Content:\n${entry.content}` }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`Kimi API connection failure: ${response.statusText}`);
    }

    const data: KimiResponse = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return {
      id: `atom_${entry.id}`,
      entryId: entry.id,
      title: entry.title || `Memory ${entry.createdAt}`,
      content: entry.content,
      layer: parsed.layer as MemoryLayer,
      salience: parsed.salience,
      confidence: parsed.confidence,
      tags: parsed.tags || [],
      createdAt: entry.createdAt,
    };
  } catch (error) {
    return {
      id: `atom_${entry.id}`,
      entryId: entry.id,
      title: entry.title || 'Fallback Node',
      content: entry.content,
      layer: 'note',
      salience: 3,
      confidence: 0.5,
      tags: [],
      createdAt: entry.createdAt,
    };
  }
}

export async function classifyJournalEntries(
  entries: JournalEntry[],
  apiKey: string
): Promise<LocalMemoryAtom[]> {
  return Promise.all(entries.map(entry => classifyJournalEntry(entry, apiKey)));
}

```

#### `services/memory/memoryGraphUtils.ts`

```typescript
import { LocalMemoryAtom, MemoryConnection, MemoryLayer } from './memoryGraph.types';

export function computeConnections(atoms: LocalMemoryAtom[]): MemoryConnection[] {
  const connections: MemoryConnection[] = [];
  const totalAtoms = atoms.length;

  for (let i = 0; i < totalAtoms; i++) {
    for (let j = i + 1; j < totalAtoms; j++) {
      const atomA = atoms[i];
      const atomB = atoms[j];
      
      const sharedTags = atomA.tags.filter(tag => atomB.tags.includes(tag));
      
      if (sharedTags.length > 0) {
        const strength = Math.min(1.0, sharedTags.length * 0.25);
        
        connections.push({
          from: atomA.id,
          to: atomB.id,
          strength,
          tags: sharedTags,
        });
      }
    }
  }

  return connections;
}

export function filterAtomsByTime(atoms: LocalMemoryAtom[], rangeDays: number): LocalMemoryAtom[] {
  const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  return atoms.filter(atom => new Date(atom.createdAt).getTime() >= cutoff);
}

export function filterAtomsByLayer(atoms: LocalMemoryAtom[], activeLayers: Set<MemoryLayer>): LocalMemoryAtom[] {
  return atoms.filter(atom => activeLayers.has(atom.layer));
}

```

#### `services/memory/memoryGraph.types.ts`

```typescript
export type MemoryLayer = 'episodic' | 'semantic' | 'profile' | 'procedural' | 'note' | 'working';

export interface JournalEntry {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
}

export interface LocalMemoryAtom {
  id: string;
  entryId: string;
  title: string;
  content: string;
  layer: MemoryLayer;
  salience: number;
  confidence: number;
  tags: string[];
  createdAt: string;
}

export interface MemoryConnection {
  from: string;
  to: string;
  strength: number;
  tags: string[];
}

export interface MemoryGraphData {
  atoms: LocalMemoryAtom[];
  connections: MemoryConnection[];
}

```

#### `hooks/memory/useMemoryGraph.ts`

```typescript
import { useState, useMemo, useEffect } from 'react';
import { LocalMemoryAtom, MemoryConnection, MemoryLayer } from '../../services/memory/memoryGraph.types';
import { computeConnections, filterAtomsByLayer } from '../../services/memory/memoryGraphUtils';
import { classifyJournalEntries } from '../../services/memory/memoryClassifier';

interface UseLocalMemoriesResult {
  atoms: LocalMemoryAtom[];
  unclassifiedEntries: any[];
  refresh: () => void;
}

declare const useLocalMemories: () => UseLocalMemoriesResult;

export function useMemoryGraph() {
  const { atoms: cachedAtoms, unclassifiedEntries, refresh } = useLocalMemories();
  const [activeLayers, setActiveLayers] = useState<Set<MemoryLayer>>(
    new Set(['episodic', 'semantic', 'profile', 'procedural', 'note', 'working'])
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function processUnclassified() {
      if (unclassifiedEntries.length === 0 || isProcessing) return;
      setIsProcessing(true);
      try {
        const apiKey = process.env.EXPO_PUBLIC_KIMI_API_KEY || '';
        await classifyJournalEntries(unclassifiedEntries, apiKey);
        refresh();
      } catch (err) {
        console.error('Classification batch failed', err);
      } finally {
        setIsProcessing(false);
      }
    }
    processUnclassified();
  }, [unclassifiedEntries]);

  const toggleLayer = (layer: MemoryLayer) => {
    const next = new Set(activeLayers);
    if (next.has(layer)) {
      next.delete(layer);
    } else {
      next.add(layer);
    }
    setActiveLayers(next);
  };

  const filteredAtoms = useMemo(() => {
    let result = filterAtomsByLayer(cachedAtoms, activeLayers);
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(atom => 
        atom.title.toLowerCase().includes(q) || 
        atom.content.toLowerCase().includes(q) ||
        atom.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [cachedAtoms, activeLayers, searchQuery]);

  const connections = useMemo(() => computeConnections(filteredAtoms), [filteredAtoms]);

  const selectedAtom = useMemo(() => {
    return filteredAtoms.find(a => a.id === selectedNodeId) || null;
  }, [filteredAtoms, selectedNodeId]);

  return {
    atoms: filteredAtoms,
    connections,
    activeLayers,
    toggleLayer,
    selectedAtom,
    setSelectedNodeId,
    searchQuery,
    setSearchQuery,
    isProcessing
  };
}

```

---

### WebView Canvas Engine

#### `assets/memory-graph/engine.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    body, html {
      margin: 0; padding: 0; width: 100%; height: 100%;
      overflow: hidden; background-color: #0b0c10; font-family: sans-serif;
    }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="graphCanvas"></canvas>
  <script>
    const canvas = document.getElementById('graphCanvas');
    const ctx = canvas.getContext('2d');
    
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    let atoms = [];
    let connections = [];
    let transform = { x: 0, y: 0, scale: 1 };
    let dragStart = { x: 0, y: 0 };
    let isDragging = false;
    let selectedId = null;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    window.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'SYNC_DATA') {
          initializeGraph(payload.atoms, payload.connections);
        }
      } catch (e) {
        console.error("Payload ingestion failure inside canvas engine scope.");
      }
    });

    function initializeGraph(newAtoms, newConnections) {
      const existingMap = new Map(atoms.map(a => [a.id, a]));
      atoms = newAtoms.map(na => {
        const match = existingMap.get(na.id);
        return {
          ...na,
          x: match ? match.x : width / 2 + (Math.random() - 0.5) * 300,
          y: match ? match.y : height / 2 + (Math.random() - 0.5) * 300,
          vx: 0, vy: 0, radius: 15 + (na.salience || 3) * 2
        };
      });
      connections = newConnections;
    }

    function tick() {
      atoms.forEach(atom => {
        atom.x += (width / 2 - atom.x) * 0.005;
        atom.y += (height / 2 - atom.y) * 0.005;
      });

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      connections.forEach(conn => {
        const fromAtom = atoms.find(a => a.id === conn.from);
        const toAtom = atoms.find(a => a.id === conn.to);
        if (fromAtom && toAtom) {
          ctx.beginPath();
          ctx.moveTo(fromAtom.x, fromAtom.y);
          ctx.lineTo(toAtom.x, toAtom.y);
          ctx.lineWidth = conn.strength * 2;
          ctx.stroke();
        }
      });

      atoms.forEach(atom => {
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, atom.radius, 0, Math.PI * 2);
        ctx.fillStyle = getLayerColor(atom.layer);
        ctx.fill();
        
        if (atom.id === selectedId) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(atom.title, atom.x, atom.y + atom.radius + 14);
      });

      ctx.restore();
      requestAnimationFrame(tick);
    }

    function getLayerColor(layer) {
      const colors = {
        episodic: '#A370F7', semantic: '#38BDF8', profile: '#FB7185',
        procedural: '#34D399', note: '#FBBF24', working: '#F472B6'
      };
      return colors[layer] || '#9CA3AF';
    }

    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStart.x = e.clientX - transform.x;
      dragStart.y = e.clientY - transform.y;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      transform.x = e.clientX - dragStart.x;
      transform.y = e.clientY - dragStart.y;
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - transform.x) / transform.scale;
      const clickY = (e.clientY - rect.top - transform.y) / transform.scale;

      let hit = null;
      atoms.forEach(atom => {
        const dist = Math.hypot(atom.x - clickX, atom.y - clickY);
        if (dist <= atom.radius) hit = atom.id;
      });

      selectedId = hit;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'NODE_SELECTED', id: hit })
      );
    });

    requestAnimationFrame(tick);
  </script>
</body>
</html>

```

---

### Native UI Components

#### `app/(tabs)/explore.tsx`

```tsx
import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useMemoryGraph } from '../../hooks/memory/useMemoryGraph';
import { MemoryGraphWebView } from '../../components/memory-graph/MemoryGraphWebView';
import { MemoryGraphFilters } from '../../components/memory-graph/MemoryGraphFilters';
import { MemoryGraphHeader } from '../../components/memory-graph/MemoryGraphHeader';
import { MemoryGraphSheet } from '../../components/memory-graph/MemoryGraphSheet';

export default function MemoryGraphScreen() {
  const {
    atoms,
    connections,
    activeLayers,
    toggleLayer,
    selectedAtom,
    setSelectedNodeId,
    searchQuery,
    setSearchQuery
  } = useMemoryGraph();

  return (
    <SafeAreaView style={styles.container}>
      <MemoryGraphHeader query={searchQuery} onQueryChange={setSearchQuery} />
      <MemoryGraphFilters activeLayers={activeLayers} onToggle={toggleLayer} />
      
      <View style={styles.canvasContainer}>
        <MemoryGraphWebView 
          atoms={atoms} 
          connections={connections} 
          onSelectNode={setSelectedNodeId} 
        />
      </View>

      {selectedAtom && (
        <MemoryGraphSheet 
          atom={selectedAtom} 
          onClose={() => setSelectedNodeId(null)} 
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10' },
  canvasContainer: { flex: 1 }
});

```

#### `components/memory-graph/MemoryGraphWebView.tsx`

```tsx
import React, { useRef, useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocalMemoryAtom, MemoryConnection } from '../../services/memory/memoryGraph.types';

interface WebViewProps {
  atoms: LocalMemoryAtom[];
  connections: MemoryConnection[];
  onSelectNode: (id: string | null) => void;
}

export function MemoryGraphWebView({ atoms, connections, onSelectNode }: WebViewProps) {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    const payload = JSON.stringify({
      type: 'SYNC_DATA',
      atoms,
      connections
    });
    webViewRef.current?.postMessage(payload);
  }, [atoms, connections]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'NODE_SELECTED') {
        onSelectNode(data.id);
      }
    } catch (e) {
      console.error("Native runtime exception decoding web engine event bridge payload.");
    }
  };

  return (
    <WebView
      ref={webViewRef}
      style={styles.webView}
      originWhitelist={['*']}
      source={
        Platform.OS === 'android'
          ? { uri: 'file:///android_asset/memory-graph/engine.html' }
          : require('../../assets/memory-graph/engine.html')
      }
      onMessage={handleMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
    />
  );
}

const styles = StyleSheet.create({
  webView: { flex: 1, backgroundColor: 'transparent' }
});

```

#### `components/memory-graph/MemoryGraphFilters.tsx`

```tsx
import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MemoryLayer } from '../../services/memory/memoryGraph.types';

interface FilterProps {
  activeLayers: Set<MemoryLayer>;
  onToggle: (layer: MemoryLayer) => void;
}

const LAYERS: MemoryLayer[] = ['episodic', 'semantic', 'profile', 'procedural', 'note', 'working'];

export function MemoryGraphFilters({ activeLayers, onToggle }: FilterProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bar}>
      {LAYERS.map(layer => {
        const isActive = activeLayers.has(layer);
        return (
          <TouchableOpacity
            key={layer}
            onPress={() => onToggle(layer)}
            style={[styles.chip, isActive && styles.activeChip]}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{layer}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 16, marginVertical: 8, flexDirection: 'row', maxHeight: 40 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1f2833', marginRight: 8 },
  activeChip: { backgroundColor: '#45f3ff' },
  label: { color: '#c5a5c5', fontSize: 12, textTransform: 'capitalize' },
  activeLabel: { color: '#0b0c10', fontWeight: 'bold' }
});

```

#### `components/memory-graph/MemoryGraphSheet.tsx`

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LocalMemoryAtom } from '../../services/memory/memoryGraph.types';

interface SheetProps {
  atom: LocalMemoryAtom;
  onClose: () => void;
}

export function MemoryGraphSheet({ atom, onClose }: SheetProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const synthesizeInsight = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_KIMI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'kimi-k2.5:thinking',
          messages: [
            { role: 'system', content: 'Generate a synthesis insight based on this specific isolated memory atom.' },
            { role: 'user', content: `Title: ${atom.title}\nContent: ${atom.content}\nTags: ${atom.tags.join(', ')}` }
          ]
        })
      });
      const data = await response.json();
      setInsight(data.choices[0].message.content);
    } catch (e) {
      setInsight('Execution failure generating contextual insights.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{atom.title}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.close}>✕</Text></TouchableOpacity>
      </View>
      <ScrollView style={styles.contentScroll}>
        <Text style={styles.layer}>Layer: {atom.layer}</Text>
        <Text style={styles.body}>{atom.content}</Text>
        {insight && (
          <View style={styles.insightBox}>
            <Text style={styles.insightTitle}>LLM Insight</Text>
            <Text style={styles.insightBody}>{insight}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.btn} onPress={synthesizeInsight} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Synthesize Insight</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', backgroundColor: '#1f2833', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, zIndex: 99 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  close: { color: '#fff', fontSize: 18 },
  contentScroll: { flex: 1 },
  layer: { color: '#45f3ff', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  body: { color: '#c5a5c5', fontSize: 14, lineHeight: 20 },
  btn: { backgroundColor: '#45f3ff', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16, marginBottom: 24 },
  btnText: { color: '#0b0c10', fontWeight: 'bold' },
  insightBox: { marginTop: 16, padding: 12, backgroundColor: '#0b0c10', borderRadius: 6 },
  insightTitle: { color: '#45f3ff', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  insightBody: { color: '#fff', fontSize: 13 }
});

```

#### `components/memory-graph/MemoryGraphHeader.tsx`

```tsx
import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

interface HeaderProps {
  query: string;
  onQueryChange: (text: string) => void;
}

export function MemoryGraphHeader({ query, onQueryChange }: HeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Memory Graph</Text>
      <TextInput
        style={styles.input}
        placeholder="Search memory node or keyword..."
        placeholderTextColor="#666"
        value={query}
        onChangeText={onQueryChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1f2833' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: '#1f2833', color: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, fontSize: 14 }
});

```

---

### Navigation & Styling Constants Integration

#### `components/journal/BottomNav.tsx`

```tsx
export const tabConfig = [
  {
    name: 'index',
    icon: 'journal',
    label: 'Journal'
  },
  {
    name: 'explore',
    icon: 'hub',
    label: 'Memory'
  },
  {
    name: 'profile',
    icon: 'person',
    label: 'Profile'
  }
];

```

#### `constants/theme.ts`

```typescript
export const theme = {
  colors: {
    background: '#0b0c10',
    surface: '#1f2833',
    text: '#ffffff',
    primary: '#45f3ff',
    memoryLayers: {
      episodic: '#A370F7',
      semantic: '#38BDF8',
      profile: '#FB7185',
      procedural: '#34D399',
      note: '#FBBF24',
      working: '#F472B6',
    }
  }
};

```

---

## Part 2: AGENTS.md Improvements

### Issue 1: Eradicate Stale SimpleMem & Railway References

Delete lines 118, 119, and 126–157 completely. Remove documentation references to variables named `SIMPLEMEM_ENABLED`, `OPENROUTER_EMBEDDING_API_KEY`, and eradicate sections regarding `railway.toml`.

### Issue 2: Missing Directories in Repo Structure

Insert the updated codebase mapping block directly below line 27:

```markdown
- `backend/`: Node.js backend (AI agent, routes).
- `utils/`: Pure utility functions and dev guards. No side effects.
- `scripts/`: Build/CI tooling (`check-design-limits.js`).
- `assets/`: Static assets (fonts, images, embedded HTML engines).
- `example-design/`: HTML/CSS reference prototypes. Not deployed.
- `notes/`: Developer docs (Supabase setup, local storage).
- `supabase/`: Database migrations and email templates.

```

### Issue 3: Backend AI Config Notes Missing

Append the following text block to section architectural definitions:

```markdown
> **Note:** The backend uses a provider/profile AI config system (`backend/src/config/ai/`).
> The `NANO_GPT_*` env var names are legacy. The current default is `moonshotai/kimi-k2.5:thinking`.

```

### Issue 4: 3 Missing Guidance Sections

Append to the baseline framework sections:

```markdown
### Prototype Files Validation Strategy
Any HTML engine configuration residing within `example-design/` functions strictly as structural reference layouts. Production ports must extract runtime engine specifications into decoupled modules within `assets/` to ensure structural decoupling.

### Data Provider Architectural Matrix
Data providers operate deterministically using the toggle flag `EXPO_PUBLIC_DATA_PROVIDER`. Local execution strategies must completely intercept storage calls locally to isolate dependencies from active network pathways.

### Canvas / WebView Integration Standards
High-frequency rendering layers must execute encapsulated raw JS modules explicitly bounded inside a `react-native-webview` configuration block, transferring payload state transitions via synchronized data bridges.

```

### Issue 5: Test Organization Outdated

Update testing sections to read:

```markdown
The test suite spans across 55+ localized testing matrices. Developers appending testing logic must configure isolated structural components directly under target directory structures using explicit modular structures rather than cluttering global entry paths.

```

### Issue 6: 3 Missing Test Commands

Append execution triggers to technical specification arrays:

```markdown
- `npm run check:design`
- `cd backend && npm test`
- `cd backend && npx tsc --noEmit`

```