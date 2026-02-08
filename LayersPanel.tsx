import React, { useState } from 'react';
import {
    Eye, EyeOff, Lock, Unlock, GripVertical,
    Type, Image as ImageIcon, Box, Minus, Table, Circle
} from 'lucide-react';
import { ReportLayer } from './ReportSchema';

interface LayersPanelProps {
    layers: ReportLayer[];
    selectedIds: string[];
    onSelect: (id: string, multi: boolean) => void;
    onReorder: (dragIndex: number, hoverIndex: number) => void; // Using simplified swap for now
    onUpdate: (id: string, updates: Partial<ReportLayer>) => void;
}

const getLayerIcon = (type: string) => {
    switch (type) {
        case 'text': return Type;
        case 'image': return ImageIcon;
        case 'box': return Box;
        case 'shape': return Circle;
        case 'line': return Minus;
        case 'table': return Table;
        default: return Box;
    }
};

const LayersPanel: React.FC<LayersPanelProps> = ({
    layers, selectedIds, onSelect, onUpdate, onReorder
}) => {
    const [draggedId, setDraggedId] = useState<string | null>(null);

    // Simplified Drag Handling (for reordering)
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        const fromIndex = layers.findIndex(l => l.id === draggedId);
        const toIndex = layers.findIndex(l => l.id === targetId);

        if (fromIndex !== toIndex) {
            onReorder(fromIndex, toIndex);
        }
    };

    const handleDragEnd = () => {
        setDraggedId(null);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Layers</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Render in reverse order so top layer is at top of list */}
                {[...layers].reverse().map((layer, reverseIndex) => {
                    // Calculate actual index in the layers array
                    const index = layers.length - 1 - reverseIndex;
                    const isSelected = selectedIds.includes(layer.id);
                    const Icon = getLayerIcon(layer.type);

                    return (
                        <div
                            key={layer.id}
                            className={`flex items-center gap-2 px-3 py-2 border-b border-slate-50 text-sm group cursor-pointer select-none transition-colors
                                ${isSelected ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-slate-50'}
                                ${draggedId === layer.id ? 'opacity-50' : 'opacity-100'}
                            `}
                            onClick={(e) => onSelect(layer.id, e.shiftKey || e.ctrlKey)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, layer.id)}
                            onDragOver={(e) => handleDragOver(e, layer.id)}
                            onDragEnd={handleDragEnd}
                        >
                            <GripVertical size={14} className="text-slate-300 cursor-grab active:cursor-grabbing" />

                            <Icon size={14} className="text-slate-400" />

                            {/* Editable Name Input */}
                            <input
                                className={`flex-1 bg-transparent border-none outline-none text-slate-700 min-w-0 ${layer.locked ? 'text-slate-400' : ''}`}
                                value={layer.name || layer.type}
                                onChange={(e) => onUpdate(layer.id, { name: e.target.value })}
                                onClick={(e) => e.stopPropagation()} // Prevent selection when clicking input
                            />

                            {/* Visibility Toggle */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdate(layer.id, { visible: !layer.visible });
                                }}
                                className={`p-1 rounded hover:bg-slate-200 ${!layer.visible ? 'text-slate-400' : 'text-slate-300 group-hover:text-slate-500'}`}
                            >
                                {layer.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>

                            {/* Lock Toggle */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdate(layer.id, { locked: !layer.locked });
                                }}
                                className={`p-1 rounded hover:bg-slate-200 ${layer.locked ? 'text-red-400' : 'text-slate-300 group-hover:text-slate-500'}`}
                            >
                                {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                    );
                })}

                {layers.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                        No layers yet. Add elements from the library.
                    </div>
                )}
            </div>
        </div>
    );
};

export default LayersPanel;
