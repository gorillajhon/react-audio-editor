"use client";

import { FC } from "react";
import { Block, ColorResult } from "@uiw/react-color";

interface Props {
  defaultHexColor?: string;
  onChange?: (color: ColorResult) => void;
}

const BlockColorPicker: FC<Props> = ({
  defaultHexColor = "#0b1220",
  onChange,
}) => {
  return (
    <div className="flex items-center gap-4">
      <Block
        color={defaultHexColor}
        onChange={onChange} // c has {hex, rgb, hsl, hsv}
        colors={[
          "#F44336",
          "#E91E63",
          "#9C27B0",
          "#673AB7",
          "#3F51B5",
          "#2196F3",
          "#03A9F4",
          "#00BCD4",
          "#009688",
          "#4CAF50",
          "#8BC34A",
          "#CDDC39",
          "#FFEB3B",
          "#FFC107",
          "#FF9800",
          "#FF5722",
        ]}
      />
    </div>
  );
};

export default BlockColorPicker;
