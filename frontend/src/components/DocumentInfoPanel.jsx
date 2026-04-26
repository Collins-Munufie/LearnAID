import { motion } from "framer-motion";
import { BookOpen, Lightbulb, FileText, BarChart3 } from "lucide-react";

export default function DocumentInfoPanel({ documentInfo }) {
  if (!documentInfo) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-gradient-to-br from-brand-surface to-brand-bg border border-brand-border rounded-2xl p-6 h-fit sticky top-8 max-h-[calc(100vh-120px)] overflow-y-auto"
    >
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-text mb-2 flex items-center gap-2">
          <FileText className="w-6 h-6 text-brand-primary" />
          Document Preview
        </h2>
        <p className="text-brand-muted text-sm">
          Extracted information from your source
        </p>
      </div>

      {/* Document Title */}
      {documentInfo.title && (
        <div className="mb-6 pb-6 border-b border-brand-border">
          <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wide mb-2">
            Title
          </h3>
          <p className="text-base font-medium text-brand-text line-clamp-3">
            {documentInfo.title}
          </p>
        </div>
      )}

      {/* Summary */}
      {documentInfo.summary && (
        <div className="mb-6 pb-6 border-b border-brand-border">
          <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wide mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            Summary
          </h3>
          <p className="text-sm text-brand-text/80 leading-relaxed">
            {documentInfo.summary}
          </p>
        </div>
      )}

      {/* Key Concepts */}
      {documentInfo.key_concepts && documentInfo.key_concepts.length > 0 && (
        <div className="mb-6 pb-6 border-b border-brand-border">
          <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wide mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            Key Concepts
          </h3>
          <div className="flex flex-wrap gap-2">
            {documentInfo.key_concepts.map((concept, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary rounded-full text-xs font-medium"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Points */}
      {documentInfo.key_points && documentInfo.key_points.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wide mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-400" />
            Key Points
          </h3>
          <ul className="space-y-2">
            {documentInfo.key_points.map((point, idx) => (
              <li
                key={idx}
                className="text-sm text-brand-text/80 flex gap-2 leading-relaxed"
              >
                <span className="text-brand-primary font-bold flex-shrink-0 mt-1">
                  •
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Word Count */}
      {documentInfo.word_count && (
        <div className="mt-6 pt-6 border-t border-brand-border">
          <div className="flex justify-between items-center text-xs text-brand-muted">
            <span>Approximate Word Count:</span>
            <span className="font-semibold text-brand-text">
              {documentInfo.word_count.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
