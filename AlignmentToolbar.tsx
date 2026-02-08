import React from 'react';
import {
    AlignLeft, AlignCenter, AlignRight,
    AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd
} from 'lucide-react';

interface AlignmentToolbarProps {
    onAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
    disabled?: boolean;
}

const AlignmentToolbar: React.FC<AlignmentToolbarProps> = ({ onAlign, disabled = false }) => {
    const buttonClass = disabled
        ? "p-2 rounded text-slate-300 cursor-not-allowed"
        : "p-2 rounded text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer";

    return (
        <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200">
            <div className="text-xs font-semibold text-slate-500 mr-2">ALIGN</div>

            {/* Horizontal Alignment */}
            <div className="flex gap-0.5 mr-3">
                <button
                    onClick={() => !disabled && onAlign('left')}
                    className={buttonClass}
                    title="Align Left"
                    disabled={disabled}
                >
                    <AlignLeft size={18} />
                </button>
                <button
                    onClick={() => !disabled && onAlign('center')}
                    className={buttonClass}
                    title="Align Center"
                    disabled={disabled}
                >
                    <AlignCenter size={18} />
                </button>
                <button
                    onClick={() => !disabled && onAlign('right')}
                    className={buttonClass}
                    title="Align Right"
                    disabled={disabled}
                >
                    <AlignRight size={18} />
                </button>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            {/* Vertical Alignment */}
            <div className="flex gap-0.5 ml-3">
                <button
                    onClick={() => !disabled && onAlign('top')}
                    className={buttonClass}
                    title="Align Top"
                    disabled={disabled}
                >
                    <AlignVerticalJustifyStart size={18} />
                </button>
                <button
                    onClick={() => !disabled && onAlign('middle')}
                    className={buttonClass}
                    title="Align Middle"
                    disabled={disabled}
                >
                    <AlignVerticalJustifyCenter size={18} />
                </button>
                <button
                    onClick={() => !disabled && onAlign('bottom')}
                    className={buttonClass}
                    title="Align Bottom"
                    disabled={disabled}
                >
                    <AlignVerticalJustifyEnd size={18} />
                </button>
            </div>

            {disabled && (
                <div className="ml-4 text-xs text-slate-400 italic">
                    Select an element to use alignment tools
                </div>
            )}
        </div>
    );
};

export default AlignmentToolbar;
