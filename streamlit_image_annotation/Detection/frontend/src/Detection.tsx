import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps
} from "streamlit-component-lib"
import React, { useEffect, useState } from "react"
import { ChakraProvider, Select, Box, Spacer, HStack, Center, Button, Text } from '@chakra-ui/react'

import useImage from 'use-image';

import ThemeSwitcher from './ThemeSwitcher'

import BBoxCanvas from "./BBoxCanvas";

export interface PythonArgs {
  image_url: string,
  image_size: number[],
  label_list: string[],
  bbox_info: any[],
  color_map: any,
  line_width: number,
  use_space: boolean
}

const Detection = ({ args, theme }: ComponentProps) => {
  const {
    image_url,
    image_size,
    label_list,
    bbox_info,
    color_map,
    line_width,
    use_space
  }: PythonArgs = args
  const [image] = useImage(image_url)
  const [rectangles, setRectangles] = React.useState(
    bbox_info.map((bb, i) => {
      return {
        x: bb.bbox[0],
        y: bb.bbox[1],
        width: bb.bbox[2],
        height: bb.bbox[3],
        label: bb.label,
        stroke: color_map[bb.label],
        id: 'bbox-' + i
      }
    }));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [label, setLabel] = useState(label_list[0])
  const [mode, setMode] = React.useState<string>('Transform');

  const handleClassSelectorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLabel(event.target.value)
    console.log(selectedId)
    if (!(selectedId === null)) {
      const rects = rectangles.slice();
      for (let i = 0; i < rects.length; i++) {
        if (rects[i].id === selectedId) {
          rects[i].label = event.target.value;
          rects[i].stroke = color_map[rects[i].label]
        }
      }
      setRectangles(rects)
    }
  }
  const [scale, setScale] = useState(1.0)
  useEffect(() => {
    const resizeCanvas = () => {
      const scale_ratio = window.innerWidth * 0.8 / image_size[0]
      console.log("scale_ratio",scale_ratio)
      setScale(Math.min(scale_ratio, 1.0))
      Streamlit.setFrameHeight(image_size[1] * Math.min(scale_ratio, 1.0))
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas()
  }, [image_size])

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (use_space && event.key === ' ') { // 32 is the key code for Space key
        const currentBboxValue = rectangles.map((rect, i) => {
          return {
            bbox: [rect.x, rect.y, rect.width, rect.height],
            label_id: label_list.indexOf(rect.label),
            label: rect.label
          }
        })
        Streamlit.setComponentValue(currentBboxValue)
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [rectangles]);

  return (
    <ChakraProvider>
      <ThemeSwitcher theme={theme}>
        <Center>
          <HStack>
            <Box width="80%">
              <BBoxCanvas
                rectangles={rectangles}
                mode={mode}
                selectedId={selectedId}
                scale={scale}
                setSelectedId={setSelectedId}
                setRectangles={setRectangles}
                setLabel={setLabel}
                color_map={color_map}
                label={label}
                image={image}
                image_size={image_size}
                strokeWidth={line_width}
              />
            </Box>
            <Spacer />
            <Box>
              <Text fontSize='sm'>Mode</Text>
              <Select value={mode} onChange={(e) => { setMode(e.target.value) }}>
                {['Transform', 'Del'].map(
                  (m) =>
                    <option value={m}>{m}</option>
                )}
              </Select>
              <Text fontSize='sm'>Class</Text>
              <Select value={label} onChange={handleClassSelectorChange}>
                {label_list.map(
                  (l) =>
                    <option value={l}>{l}</option>
                )
                }
              </Select>

              <Button onClick={(e) => {
                const currentBboxValue = rectangles.map((rect, i) => {
                  return {
                    bbox: [rect.x, rect.y, rect.width, rect.height],
                    label_id: label_list.indexOf(rect.label),
                    label: rect.label
                  }
                })
                Streamlit.setComponentValue(currentBboxValue)
              }}>Complete</Button>
            </Box>
          </HStack>
        </Center>
      </ThemeSwitcher>
    </ChakraProvider>
  )

}


export default withStreamlitConnection(Detection)
