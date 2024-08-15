import { atom } from "recoil";
export const isDrawingState = atom({
  key: "isDrawingState",
  default: false,
});

export const currentPathState = atom({
  key: "currentPathState",
  default: null,
});

export const pathsState = atom({
  key: "pathsState",
  default: [],
});

export const toolState = atom({
  key: "toolState",
  default: "pencil",
});

export const colorState = atom({
  key: "colorState",
  default: "#000000",
});

export const strokeWidthState = atom({
  key: "strokeWidthState",
  default: 2,
});

export const startPositionState = atom({
  key: "startPositionState",
  default: null,
});

export const currentShapeState = atom({
  key: "currentShapeState",
  default: null,
});

export const textState = atom({
  key: "textState",
  default: "",
});
