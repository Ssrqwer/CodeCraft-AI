"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  ArrowLeft,
  Sparkles,
  MessageSquare,
  Clock,
  FileText,
  ArrowLeftRight,
  Bird,
  Lightbulb,
  X,
  ChevronDown,
  Copy,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useCodeEditorStore } from "@/store/useCodeEditorStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionId =
  | "explain"
  | "complexity"
  | "docstring"
  | "convert"
  | "rubber-duck"
  | "idea-to-code";

type Tab = "editor" | "manual";

interface Action {
  id: ActionId;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  fullWidth?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIONS: Action[] = [
  {
    id: "explain",
    label: "Explain Code",
    description: "Get a plain-English explanation of what your code does",
    icon: <MessageSquare size={20} />,
    color: "from-blue-500 to-cyan-400",
    gradient: "rgba(59,130,246,0.15)",
  },
  {
    id: "complexity",
    label: "Complexity",
    description: "Analyze time & space complexity with Big-O notation",
    icon: <Clock size={20} />,
    color: "from-amber-500 to-orange-400",
    gradient: "rgba(245,158,11,0.15)",
  },
  {
    id: "docstring",
    label: "Docstring",
    description: "Auto-generate professional docstrings for your functions",
    icon: <FileText size={20} />,
    color: "from-emerald-500 to-teal-400",
    gradient: "rgba(16,185,129,0.15)",
  },
  {
    id: "convert",
    label: "Convert",
    description: "Translate your code to another programming language",
    icon: <ArrowLeftRight size={20} />,
    color: "from-violet-500 to-purple-400",
    gradient: "rgba(139,92,246,0.15)",
  },
  {
    id: "rubber-duck",
    label: "Rubber Duck",
    description: "Ask questions about your code and get smart answers",
    icon: <Bird size={20} />,
    color: "from-pink-500 to-rose-400",
    gradient: "rgba(236,72,153,0.15)",
  },
  {
    id: "idea-to-code",
    label: "Idea → Code",
    description: "Describe an idea in plain English and get working code instantly",
    icon: <Lightbulb size={20} />,
    color: "from-yellow-400 to-amber-300",
    gradient: "rgba(251,191,36,0.15)",
    fullWidth: true,
  },
];

const LANGUAGES = ["javascript", "typescript", "python", "go", "rust", "java", "cpp", "csharp", "ruby", "swift"];
const TARGET_LANGUAGES = ["javascript", "typescript", "go", "rust", "python", "java", "cpp"];
const DOCSTRING_STYLES = ["Google", "NumPy", "Sphinx"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[100, 80, 90, 60, 75].map((w, i) => (
        <div key={i} className="h-3 rounded-full bg-white/[0.07]" style={{ width: `${w}%` }} />
      ))}
      <div className="h-3 rounded-full bg-white/[0.07] w-1/2" />
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/[0.07]">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        title="Copy code"
      >
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white/60" />}
      </button>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "#0d0d14",
          fontSize: "0.825rem",
          lineHeight: "1.6",
          padding: "1.25rem",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="prose prose-invert prose-sm max-w-none ai-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const inline = !match;
            return !inline ? (
              <CodeBlock code={String(children).replace(/\n$/, "")} language={match![1]} />
            ) : (
              <code className="bg-white/10 px-1.5 py-0.5 rounded text-purple-300 text-xs font-mono" {...props}>
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="text-white/80 leading-relaxed mb-3 text-sm">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-white font-bold text-lg mb-3 mt-5">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-white font-semibold text-base mb-2 mt-4">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-white/90 font-semibold text-sm mb-2 mt-3">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 space-y-1 mb-3">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 space-y-1 mb-3">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-white/75 text-sm">{children}</li>;
          },
          strong({ children }) {
            return <strong className="text-white font-semibold">{children}</strong>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-purple-500 pl-4 italic text-white/60 my-3">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/50 uppercase tracking-wider font-medium">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-[#0d0d14] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white/90 focus:outline-none focus:border-purple-500/60 cursor-pointer pr-10 transition-colors"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  onClose,
  onReturn,
}: {
  message: string;
  onClose: () => void;
  onReturn: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 60, scale: 0.9 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#1e1e2e] border border-emerald-500/30 rounded-2xl px-5 py-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check size={13} className="text-emerald-400" />
        </div>
        <span className="text-white/90 text-sm font-medium">{message}</span>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <button
          onClick={onReturn}
          className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
        >
          Return to Editor
        </button>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const router = useRouter();
  const { language, code: zustandCode, setCode } = useCodeEditorStore();

  // Panel state
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [manualCode, setManualCode] = useState("");

  // Loading & response
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-action inputs
  const [question, setQuestion] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("typescript");
  const [docstringStyle, setDocstringStyle] = useState("Google");
  const [idea, setIdea] = useState("");
  const [ideaLanguage, setIdeaLanguage] = useState(language || "javascript");

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const editorCode = zustandCode;
  const activeCode = activeTab === "editor" ? editorCode : manualCode;
  const lineCount = editorCode.split("\n").length;

  const selectAction = (id: ActionId) => {
    setSelectedAction(id);
    setResponse(null);
    setError(null);
    setActiveTab("editor");
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 4500);
  };

  const handleInsert = (code: string) => {
    setCode(code);
    showToast("✓ Code inserted into editor");
  };

  // ─── API Calls ────────────────────────────────────────────────────────────
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const callApi = useCallback(
    async (endpoint: string, body: Record<string, string>) => {
      setIsLoading(true);
      setError(null);
      setResponse(null);
      try {
        const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "Request failed" }));
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setResponse(data);
      } catch (e: any) {
        setError(e.message || "Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

    const handleExplain = () => callApi("explain-code", { code: activeCode });
    const handleComplexity = () => callApi("analyze-complexity", { code: activeCode });
    const handleDocstring = () => callApi("generate-docstring", { code: activeCode, style: docstringStyle });
    const handleConvert = () => callApi("convert-language", { code: activeCode, target_language: targetLanguage });
    const handleRubberDuck = () => callApi("rubber-duck", { code_context: activeCode, question });
    const handleIdeaToCode = () => callApi("generate-code", { idea, language: ideaLanguage });

  // ─── Action Panel Content ─────────────────────────────────────────────────

  const renderInputArea = (needsCode = true) => {
    if (!needsCode) return null;
    return (
      <div className="mb-5">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#0d0d14] rounded-xl mb-4 border border-white/[0.05] w-fit">
          {(["editor", "manual"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                activeTab === tab
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {tab === "editor" ? "From Editor" : "Write Manually"}
            </button>
          ))}
        </div>

        {activeTab === "editor" ? (
          editorCode ? (
            <div className="rounded-xl overflow-hidden border border-white/[0.06] max-h-48 overflow-y-auto">
              <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  background: "#0d0d14",
                  fontSize: "0.775rem",
                  padding: "1rem",
                }}
              >
                {editorCode.length > 600 ? editorCode.slice(0, 600) + "\n..." : editorCode}
              </SyntaxHighlighter>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
              <p className="text-amber-400/80 text-sm">
                No code in the editor. Switch to <span className="font-semibold text-amber-400">Write Manually</span> or add some code.
              </p>
            </div>
          )
        ) : (
          <textarea
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Paste or write your code here..."
            rows={8}
            className="w-full bg-[#0d0d14] border border-white/[0.08] focus:border-purple-500/50 rounded-xl p-4 text-sm text-white/90 font-mono resize-none focus:outline-none transition-colors placeholder:text-white/25"
          />
        )}
      </div>
    );
  };

  const renderActionControls = (action: ActionId) => {
    switch (action) {
      case "explain":
        return (
          <>
            {renderInputArea()}
            <button
              onClick={handleExplain}
              disabled={isLoading || (!activeCode && activeTab === "editor") || (!manualCode && activeTab === "manual")}
              className="btn-primary w-full"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : "✨"}
              <span>{isLoading ? "Explaining…" : "Explain Code"}</span>
            </button>
          </>
        );

      case "complexity":
        return (
          <>
            {renderInputArea()}
            <button
              onClick={handleComplexity}
              disabled={isLoading || !activeCode}
              className="btn-primary w-full"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : "🔍"}
              <span>{isLoading ? "Analyzing…" : "Analyze Complexity"}</span>
            </button>
          </>
        );

      case "docstring":
        return (
          <>
            {renderInputArea()}
            <Select
              value={docstringStyle}
              onChange={setDocstringStyle}
              options={DOCSTRING_STYLES}
              label="Docstring Style"
            />
            <div className="mt-4">
              <button
                onClick={handleDocstring}
                disabled={isLoading || !activeCode}
                className="btn-primary w-full"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : "📝"}
                <span>{isLoading ? "Generating…" : "Generate Docstring"}</span>
              </button>
            </div>
          </>
        );

      case "convert":
        return (
          <>
            {renderInputArea()}
            <Select
              value={targetLanguage}
              onChange={setTargetLanguage}
              options={TARGET_LANGUAGES}
              label="Target Language"
            />
            <div className="mt-4">
              <button
                onClick={handleConvert}
                disabled={isLoading || !activeCode}
                className="btn-primary w-full"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : "🔄"}
                <span>{isLoading ? "Converting…" : "Convert Code"}</span>
              </button>
            </div>
          </>
        );

      case "rubber-duck":
        return (
          <>
            {renderInputArea()}
            <div className="mb-4">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">
                Your Question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What does this loop actually do? Why is it slow? How can I fix…"
                rows={3}
                className="w-full bg-[#0d0d14] border border-white/[0.08] focus:border-purple-500/50 rounded-xl p-4 text-sm text-white/90 resize-none focus:outline-none transition-colors placeholder:text-white/25"
              />
            </div>
            <button
              onClick={handleRubberDuck}
              disabled={isLoading || !question.trim()}
              className="btn-primary w-full"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : "🦆"}
              <span>{isLoading ? "Thinking…" : "Ask Duck"}</span>
            </button>
          </>
        );

      case "idea-to-code":
        return (
          <>
            <div className="mb-4">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">
                Describe Your Idea
              </label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Build a binary search function that returns the index of a target value in a sorted array, or -1 if not found…"
                rows={5}
                className="w-full bg-[#0d0d14] border border-white/[0.08] focus:border-purple-500/50 rounded-xl p-4 text-sm text-white/90 resize-none focus:outline-none transition-colors placeholder:text-white/25"
              />
            </div>
            <Select
              value={ideaLanguage}
              onChange={setIdeaLanguage}
              options={LANGUAGES}
              label="Language"
            />
            <div className="mt-4">
              <button
                onClick={handleIdeaToCode}
                disabled={isLoading || !idea.trim()}
                className="btn-primary w-full"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : "💡"}
                <span>{isLoading ? "Generating…" : "Generate Code"}</span>
              </button>
            </div>
          </>
        );
    }
  };

  const renderResponse = (action: ActionId) => {
    if (isLoading) return <LoadingSkeleton />;
    if (error) {
      return (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/5">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400/90 text-sm">{error}</p>
        </div>
      );
    }
    if (!response) return null;

    switch (action) {
      case "explain":
        return <MarkdownContent content={response.explanation_md} />;

      case "complexity":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Time", value: response.time_complexity, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                { label: "Space", value: response.space_complexity, color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-xl border p-4 ${color}`}>
                  <div className="text-xs uppercase tracking-wider opacity-60 mb-1">{label} Complexity</div>
                  <div className="text-xl font-bold font-mono">{value}</div>
                </div>
              ))}
            </div>
            {response.bottlenecks && (
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="text-xs text-amber-400/60 uppercase tracking-wider mb-1.5">Bottleneck</div>
                <p className="text-amber-300/80 text-sm">{response.bottlenecks}</p>
              </div>
            )}
            <MarkdownContent content={response.analysis_md} />
          </div>
        );

      case "docstring":
        return (
          <div className="space-y-3">
            <CodeBlock code={response.code_with_docstring} language={language} />
            <button
              onClick={() => handleInsert(response.code_with_docstring)}
              className="btn-success w-full"
            >
              <Check size={15} />
              <span>Insert into Editor</span>
            </button>
          </div>
        );

      case "convert":
        return (
          <div className="space-y-3">
            <CodeBlock code={response.converted_code} language={response.target_language || targetLanguage} />
            <button
              onClick={() => handleInsert(response.converted_code)}
              className="btn-success w-full"
            >
              <ArrowLeftRight size={15} />
              <span>Replace in Editor</span>
            </button>
          </div>
        );

      case "rubber-duck":
        return <MarkdownContent content={response.answer_md} />;

      case "idea-to-code":
        return (
          <div className="space-y-3">
            <CodeBlock code={response.code} language={response.language || ideaLanguage} />
            <button
              onClick={() => handleInsert(response.code)}
              className="btn-success w-full"
            >
              <Lightbulb size={15} />
              <span>Insert into Editor</span>
            </button>
          </div>
        );
    }
  };

  const currentAction = ACTIONS.find((a) => a.id === selectedAction);

  return (
    <>
      {/* Global styles injected inline */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .ai-page * {
          font-family: 'Inter', sans-serif;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 0.875rem;
          font-size: 0.875rem;
          font-weight: 600;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: white;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(168, 85, 247, 0.25);
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(168, 85, 247, 0.4);
        }
        .btn-primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btn-success {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 0.875rem;
          font-size: 0.875rem;
          font-weight: 600;
          background: linear-gradient(135deg, #059669, #10b981);
          color: white;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(16, 185, 129, 0.25);
        }
        .btn-success:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }

        .scrollbar-thin::-webkit-scrollbar { width: 5px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      `}</style>

      <div className="ai-page min-h-screen bg-[#0a0a0f] text-white flex flex-col">
        {/* Ambient glow background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/[0.06] blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/[0.06] blur-[120px]" />
        </div>

        {/* ─── Header ──────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.05] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2.5 text-white/50 hover:text-white transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors">
              <ArrowLeft size={16} />
            </div>
            <span className="text-sm font-medium hidden sm:block">Back to Editor</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">AI Code Assistant</h1>
              <p className="text-[10px] text-white/35 hidden sm:block">Powered by AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              {language}
            </span>
            <span className="hidden md:flex items-center px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/40">
              {lineCount} lines
            </span>
          </div>
        </motion.header>

        {/* ─── Main Layout ─────────────────────────────────────────────── */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
          {/* Left: Quick Actions */}
          <div className="lg:w-[380px] lg:min-w-[380px] p-6 lg:overflow-y-auto lg:border-r border-white/[0.04] scrollbar-thin">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-white mb-1">Quick Actions</h2>
              <p className="text-xs text-white/35">Select an action to get started</p>
            </div>

            <motion.div
              className="grid grid-cols-2 gap-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.07 } },
              }}
            >
              {ACTIONS.map((action, i) => {
                const isSelected = selectedAction === action.id;
                return (
                  <motion.button
                    key={action.id}
                    variants={{
                      hidden: { opacity: 0, y: 20, scale: 0.95 },
                      visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } },
                    }}
                    onClick={() => selectAction(action.id)}
                    className={`
                      ${action.fullWidth ? "col-span-2" : "col-span-1"}
                      relative flex flex-col gap-3 p-4 rounded-2xl border text-left
                      transition-all duration-200 group cursor-pointer
                      ${isSelected
                        ? "border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)] bg-purple-500/[0.08]"
                        : "border-white/[0.06] bg-[#1e1e2e]/60 hover:border-white/[0.15] hover:bg-[#1e1e2e]"
                      }
                    `}
                  >
                    {/* Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110`}
                    >
                      {action.icon}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-white mb-0.5">{action.label}</div>
                      <div className="text-[11px] text-white/40 leading-relaxed line-clamp-2">{action.description}</div>
                    </div>

                    {isSelected && (
                      <motion.div
                        layoutId="selectedGlow"
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{ boxShadow: `inset 0 0 0 2px rgba(168,85,247,0.6)` }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          {/* Right: Action Panel */}
          <AnimatePresence mode="wait">
            {selectedAction ? (
              <motion.div
                key={selectedAction}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col lg:overflow-y-auto scrollbar-thin"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${currentAction?.color} flex items-center justify-center text-white shadow-lg`}>
                      {currentAction?.icon}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">{currentAction?.label}</h2>
                      <p className="text-xs text-white/40">{currentAction?.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAction(null)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="flex-1 p-6 space-y-5">
                  {/* Input & Controls */}
                  <div className="bg-[#1e1e2e]/60 rounded-2xl border border-white/[0.05] p-5">
                    {renderActionControls(selectedAction)}
                  </div>

                  {/* Response */}
                  <AnimatePresence>
                    {(isLoading || response || error) && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="bg-[#1e1e2e]/60 rounded-2xl border border-white/[0.05] p-5"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          <span className="text-xs text-white/40 uppercase tracking-wider font-medium">
                            {isLoading ? "Processing…" : "Result"}
                          </span>
                        </div>
                        {renderResponse(selectedAction)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Context Bar */}
                <div className="px-6 py-3 border-t border-white/[0.04] bg-[#0a0a0f]/60 backdrop-blur-sm flex items-center gap-4 flex-wrap">
                  {[
                    { label: "Language", value: language },
                    { label: "Source", value: selectedAction === "idea-to-code" ? "Idea" : activeTab === "editor" ? "Editor" : "Manual" },
                    { label: "Lines", value: String(lineCount) },
                    {
                      label: "Mode",
                      value: activeTab === "editor" ? "Live" : "Manual",
                      accent: activeTab === "editor",
                    },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs">
                      <span className="text-white/25 uppercase tracking-wider">{label}</span>
                      <span className={`font-medium ${accent ? "text-emerald-400" : "text-white/60"}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 hidden lg:flex items-center justify-center p-12"
              >
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 border border-purple-500/20 flex items-center justify-center mx-auto mb-5">
                    <Sparkles size={28} className="text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Pick an action</h3>
                  <p className="text-sm text-white/35 leading-relaxed">
                    Choose one of the 6 AI-powered tools on the left to start working with your code.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Toast ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast.show && (
          <Toast
            message={toast.message}
            onClose={() => setToast({ show: false, message: "" })}
            onReturn={() => router.back()}
          />
        )}
      </AnimatePresence>
    </>
  );
}
