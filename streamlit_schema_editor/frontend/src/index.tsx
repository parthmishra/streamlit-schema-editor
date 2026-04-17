import {
  FrontendRenderer,
  FrontendRendererArgs,
} from "@streamlit/component-v2-lib";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";

import "./global.css";
import SchemaEditorCanvas, {
  SchemaEditorDataShape,
  SchemaEditorStateShape,
} from "./SchemaEditorCanvas";

const reactRoots: WeakMap<FrontendRendererArgs["parentElement"], Root> =
  new WeakMap();

const SchemaEditorRoot: FrontendRenderer<
  SchemaEditorStateShape,
  SchemaEditorDataShape
> = (args) => {
  const { parentElement } = args;
  const rootElement = parentElement.querySelector(".react-root");

  if (!rootElement) {
    const fallbackRoot = document.createElement("div");
    fallbackRoot.style.padding = "12px";
    fallbackRoot.style.fontSize = "0.9rem";
    fallbackRoot.textContent =
      "streamlit-schema-editor could not mount because the root container was not found.";
    parentElement.appendChild(fallbackRoot);
    return () => {
      fallbackRoot.remove();
    };
  }

  rootElement.setAttribute(
    "style",
    "display:block;width:100%;height:100%;min-height:320px;",
  );

  let reactRoot = reactRoots.get(parentElement);
  if (!reactRoot) {
    reactRoot = createRoot(rootElement);
    reactRoots.set(parentElement, reactRoot);
  }

  reactRoot.render(
    <StrictMode>
      <SchemaEditorCanvas {...args} />
    </StrictMode>,
  );

  return () => {
    const activeRoot = reactRoots.get(parentElement);

    if (activeRoot) {
      activeRoot.unmount();
      reactRoots.delete(parentElement);
    }
  };
};

export default SchemaEditorRoot;
