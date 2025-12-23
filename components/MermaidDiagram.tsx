import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
});

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderChart = async () => {
      if (!chart) return;
      
      try {
        // Unique ID for each render to avoid conflicts
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
        setError(null);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError('Failed to render diagram. Syntax might be invalid.');
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return <div className="text-red-400 text-sm p-2 border border-red-500/50 rounded bg-red-900/20">{error}</div>;
  }

  return (
    <div 
      ref={containerRef} 
      className="mermaid-container bg-gray-900 p-6 rounded-lg overflow-x-auto flex justify-center border border-gray-700 min-h-[200px]"
      dangerouslySetInnerHTML={{ __html: svgContent }} 
    />
  );
};

export default MermaidDiagram;