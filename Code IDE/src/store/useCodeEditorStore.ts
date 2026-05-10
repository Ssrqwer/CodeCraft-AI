import { CodeEditorState } from "./../types/index";
import { create } from "zustand";
import { Monaco } from "@monaco-editor/react";

const getInitialState = () => {
  // if we're on the server, return default values
  if (typeof window === "undefined") {
    return {
      language: "javascript",
      fontSize: 16,
      theme: "vs-dark",
    };
  }

  // if we're on the client, return values from local storage bc localStorage is a browser API.
  const savedLanguage = localStorage.getItem("editor-language") || "javascript";
  const savedTheme = localStorage.getItem("editor-theme") || "vs-dark";
  const savedFontSize = localStorage.getItem("editor-font-size") || 16;

  return {
    language: savedLanguage,
    theme: savedTheme,
    fontSize: Number(savedFontSize),
  };
};

export const useCodeEditorStore = create<CodeEditorState>((set, get) => {
  // Only access localStorage in useEffect or after mount
  const initialState = getInitialState();

  return {
    ...initialState,
    output: "",
    isRunning: false,
    error: null,
    editor: null,
    executionResult: null,
    code: "",

    getCode: () => get().editor?.getValue() || get().code || "",

    setCode: (newCode: string) => {
      const { editor, language } = get();
      
      // 1. Save the string to Zustand so the AI page can read it
      set({ code: newCode });
      
      // 2. Only update the Monaco instance if the value is actually different.
      // (If you skip this check, your cursor will jump to the end of the file on every keystroke!)
      if (editor && editor.getValue() !== newCode) {
        editor.setValue(newCode);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(`editor-code-${language}`, newCode);
      }
    },

    setEditor: (editor: Monaco) => {
      // Only access localStorage in client
      if (typeof window !== "undefined") {
        const savedCode = localStorage.getItem(`editor-code-${get().language}`);
        if (savedCode) editor.setValue(savedCode);
      }
      set({ editor });
    },

    setTheme: (theme: string) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("editor-theme", theme);
      }
      set({ theme });
    },

    setFontSize: (fontSize: number) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("editor-font-size", fontSize.toString());
      }
      set({ fontSize });
    },

    setLanguage: (language: string) => {
      // Save current language code before switching
      if (typeof window !== "undefined") {
        const currentCode = get().editor?.getValue();
        if (currentCode) {
          localStorage.setItem(`editor-code-${get().language}`, currentCode);
        }
        localStorage.setItem("editor-language", language);
      }

      set({
        language,
        output: "",
        error: null,
      });
    },

    runCode: async () => {
      const { language, getCode } = get();
      const code = getCode();

      if (!code) {
        set({ error: "Please enter some code" });
        return;
      }

      set({ isRunning: true, error: null, output: "" });

      try {
        // Language mapping for JDoodle
        const languageMap: Record<string, { lang: string; version: string }> = {
          'python': { lang: 'python3', version: '4' },
          'javascript': { lang: 'nodejs', version: '4' },
          'typescript': { lang: 'typescript', version: '4' },
          'java': { lang: 'java', version: '4' },
          'go': { lang: 'go', version: '1' },
          'rust': { lang: 'rust', version: '4' },
          'cpp': { lang: 'cpp17', version: '5' },
          'csharp': { lang: 'csharp', version: '5' },
          'ruby': { lang: 'ruby', version: '4' },
          'swift': { lang: 'swift', version: '5' }
        };

        const jdoodleConfig = languageMap[language] || languageMap['python'];

        const response = await fetch("/api/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            script: code,
            language: jdoodleConfig.lang,
            versionIndex: jdoodleConfig.version,
            stdin: ""
          }),
        });

        const data = await response.json();
        console.log("JDoodle response:", data);

        // Handle response
        if (data.output) {
          set({ 
            output: data.output.trim(), 
            error: null,
            executionResult: { 
              code, 
              output: data.output.trim(), 
              error: null 
            }
          });
        } else if (data.error) {
          set({ 
            error: data.error,
            executionResult: { 
              code, 
              output: "", 
              error: data.error 
            }
          });
        } else {
          set({ 
            error: "Unknown error",
            executionResult: { 
              code, 
              output: "", 
              error: "Unknown error" 
            }
          });
        }
      } catch (error) {
        console.log("Error running code:", error);
        set({ 
          error: "Failed to run code",
          executionResult: { 
            code, 
            output: "", 
            error: "Failed to run code" 
          }
        });
      } finally {
        set({ isRunning: false });
      }
    },
  };
});

export const getExecutionResult = () => useCodeEditorStore.getState().executionResult;
