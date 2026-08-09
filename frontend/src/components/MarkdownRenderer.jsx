import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ content, mode = 'notes' }) {
  const notesComponents = {
    h1: (props) => <h1 className="text-3xl font-bold mt-8 mb-4 text-brand-text break-words" {...props} />,
    h2: (props) => <h2 className="text-2xl font-bold mt-8 mb-4 text-brand-text break-words" {...props} />,
    h3: (props) => <h3 className="text-xl font-bold mt-6 mb-3 text-brand-text break-words" {...props} />,
    p: (props) => <p className="text-brand-muted leading-relaxed text-lg mb-4 break-words" {...props} />,
    ul: (props) => <ul className="list-disc list-inside space-y-2 mb-4 text-brand-muted text-lg ml-4 break-words" {...props} />,
    ol: (props) => <ol className="list-decimal list-inside space-y-2 mb-4 text-brand-muted text-lg ml-4 break-words" {...props} />,
    li: (props) => <li className="leading-relaxed break-words" {...props} />,
    strong: (props) => <strong className="font-bold text-brand-primary break-words" {...props} />,
    em: (props) => <em className="italic text-brand-text break-words" {...props} />,
    blockquote: (props) => <blockquote className="border-l-4 border-brand-primary pl-4 my-4 italic text-brand-muted break-words" {...props} />
  };

  const tutorComponents = {
    h1: (props) => <h1 className="text-3xl font-bold mt-8 mb-4 text-brand-text break-words" {...props} />,
    h2: (props) => <h2 className="text-2xl font-bold mt-8 mb-4 text-brand-text break-words" {...props} />,
    h3: (props) => <h3 className="text-xl font-bold mt-6 mb-3 text-brand-text break-words" {...props} />,
    p: (props) => <p className="text-brand-text leading-relaxed text-lg mb-4 font-medium break-words" {...props} />,
    ul: (props) => <ul className="list-disc list-inside space-y-2 mb-4 text-brand-text text-lg ml-4 break-words" {...props} />,
    ol: (props) => <ol className="list-decimal list-inside space-y-2 mb-4 text-brand-text text-lg ml-4 break-words" {...props} />,
    li: (props) => <li className="leading-relaxed break-words" {...props} />,
    strong: (props) => <strong className="font-bold text-brand-primary break-words" {...props} />,
    em: (props) => <em className="italic opacity-80 break-words" {...props} />,
    blockquote: (props) => <blockquote className="border-l-4 border-brand-primary pl-4 my-4 italic text-brand-muted break-words" {...props} />
  };

  const studyComponents = {
    h1: (props) => <h1 className="text-xl sm:text-2xl font-black mt-6 mb-3.5 text-brand-text border-b border-brand-border/60 pb-1.5 break-words" {...props} />,
    h2: (props) => <h2 className="text-lg sm:text-xl font-bold mt-5 mb-2.5 text-brand-text break-words" {...props} />,
    h3: (props) => <h3 className="text-base sm:text-lg font-bold mt-4 mb-2 text-brand-text break-words" {...props} />,
    p: (props) => <p className="text-brand-muted leading-relaxed text-xs sm:text-sm mb-3.5 break-words" {...props} />,
    ul: (props) => <ul className="list-disc list-outside space-y-2 mb-4 text-brand-muted text-xs sm:text-sm ml-5 break-words animate-fade-in" {...props} />,
    ol: (props) => <ol className="list-decimal list-outside space-y-2 mb-4 text-brand-muted text-xs sm:text-sm ml-5 break-words animate-fade-in" {...props} />,
    li: (props) => <li className="leading-relaxed pl-0.5 break-words" {...props} />,
    strong: (props) => (
      <strong className="font-extrabold text-brand-primary bg-brand-primary/5 px-1.5 py-0.5 rounded border border-brand-primary/10 inline-block break-words" {...props} />
    ),
    em: (props) => <em className="italic text-brand-text break-words" {...props} />,
    blockquote: (props) => (
      <blockquote className="bg-brand-bg/60 border-l-4 border-brand-primary pl-4 py-3 pr-3 my-4 rounded-r-xl italic text-brand-text shadow-sm border border-brand-border border-l-brand-primary break-words" {...props} />
    ),
    table: (props) => (
      <div className="overflow-x-auto my-6 rounded-xl border border-brand-border shadow-sm">
        <table className="w-full border-collapse text-[11px] sm:text-xs text-left" {...props} />
      </div>
    ),
    thead: (props) => <thead className="bg-brand-bg border-b border-brand-border text-[10px] sm:text-xs font-bold uppercase text-brand-text" {...props} />,
    tbody: (props) => <tbody className="divide-y divide-brand-border/40 bg-brand-surface" {...props} />,
    tr: (props) => <tr className="hover:bg-brand-primary/5 transition-colors" {...props} />,
    th: (props) => <th className="px-3 sm:px-4 py-2.5 font-bold text-brand-text" {...props} />,
    td: (props) => <td className="px-3 sm:px-4 py-2.5 text-brand-muted font-medium break-words" {...props} />,
    code: (props) => <code className="bg-brand-bg border border-brand-border px-1.5 py-0.5 rounded font-mono text-[10px] sm:text-xs text-brand-text break-words" {...props} />,
    pre: (props) => <pre className="bg-brand-bg border border-brand-border p-3 sm:p-4 rounded-xl font-mono text-[10px] sm:text-xs text-brand-text overflow-x-auto my-4 shadow-inner" {...props} />
  };

  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]} 
      components={mode === 'study' ? studyComponents : (mode === 'tutor' ? tutorComponents : notesComponents)}
    >
      {content}
    </ReactMarkdown>
  );
}
