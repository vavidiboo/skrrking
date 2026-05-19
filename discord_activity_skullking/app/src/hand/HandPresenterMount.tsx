// Stage 6 hand UX module - HandPresenterMount (task 8.3).
import * as React from "react";
import { useSyncExternalStore } from "react";
import { getReactUiSnapshot, subscribeReactUi } from "../legacyBridge";
import { selectCurrentView } from "../selectors/clientState";
import { HandPresenter } from "./HandPresenter";

export function HandPresenterMount(): React.JSX.Element | null {
  const reactUi = useSyncExternalStore(
    subscribeReactUi,
    getReactUiSnapshot,
    getReactUiSnapshot,
  );
  if (selectCurrentView(reactUi.clientState) !== "game") return null;
  return <HandPresenter />;
}