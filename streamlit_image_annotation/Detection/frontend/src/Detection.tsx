import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps
} from "streamlit-component-lib"
import React, { useEffect, useState, useRef } from "react"
import { ChakraProvider, Select, Box, Spacer, HStack,  VStack, Center, Button, Text } from '@chakra-ui/react'

import useImage from 'use-image';

import ThemeSwitcher from './ThemeSwitcher'

import { Layer, Rect, Stage, Image } from 'react-konva';
import BBox from './BBox'
import Konva from 'konva';

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
  // Get the last part of the path
    const filename = image_url.split('/').pop();
    const save_name = `annotated_${filename}`

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

    function blobToBase64(blob: any): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function imageBlobToJson(imageBlob: any, imageName: string): Promise<string> {
        const base64Image = await blobToBase64(imageBlob);
        const imageData = {
            name: imageName,
            type: imageBlob.type,
            data: base64Image,
        };
        return JSON.stringify(imageData);
    }



  useEffect(() => {
    const handleKeyPress = async (event: KeyboardEvent) => {

    let imgBlob = null
    let imgJson  = {}
    try{
        if (stageRef.current) {
            imgBlob = await stageRef.current.toBlob()

            console.log(imgBlob); // This will log the data URI of the stage
            imgJson = await imageBlobToJson(imgBlob, save_name)
            console.log(imgJson); // This will log the data URI of the stage

            }
    }catch{
        console.error("issue with getting img blob")
    }
      if (use_space && event.key === ' ') { // 32 is the key code for Space key
        const currentBboxValue = rectangles.map((rect, i) => {
          return {
            bbox: [rect.x, rect.y, rect.width, rect.height],
            label_id: label_list.indexOf(rect.label),
            label: rect.label
          }
        })
        Streamlit.setComponentValue({currentBboxValue, imgJson})
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [rectangles]);
  const [adding, setAdding] = useState<number[] | null>(null)
  const checkDeselect = (e: any) => {
    if (!(e.target instanceof Konva.Rect)) {
      if (selectedId === null) {
        if (mode === 'Transform') {
          const pointer = e.target.getStage().getPointerPosition()
          setAdding([pointer.x, pointer.y, pointer.x, pointer.y])
        }
      } else {
        setSelectedId(null);
      }
    }
  };
  // The ref type is Konva.Stage, as defined by the library
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    const rects = rectangles.slice();
    for (let i = 0; i < rects.length; i++) {
      if (rects[i].width < 0) {
        rects[i].width = rects[i].width * -1
        rects[i].x = rects[i].x - rects[i].width
        setRectangles(rects)
      }
      if (rects[i].height < 0) {
        rects[i].height = rects[i].height * -1
        rects[i].y = rects[i].y - rects[i].height
        setRectangles(rects)
      }
      if (rects[i].x < 0 || rects[i].y < 0) {
        rects[i].width = rects[i].width + Math.min(0, rects[i].x)
        rects[i].x = Math.max(0, rects[i].x)
        rects[i].height = rects[i].height + Math.min(0, rects[i].y)
        rects[i].y = Math.max(0, rects[i].y)
        setRectangles(rects)
      }
      if (rects[i].x + rects[i].width > image_size[0] || rects[i].y + rects[i].height > image_size[1]) {
        rects[i].width = Math.min(rects[i].width, image_size[0] - rects[i].x)
        rects[i].height = Math.min(rects[i].height, image_size[1] - rects[i].y)
        setRectangles(rects)
      }
      if (rects[i].width < 5 || rects[i].height < 5) {
        rects[i].width = 5
        rects[i].height = 5
      }
    }
  }, [rectangles, image_size])
  return (
    <ChakraProvider>
      <ThemeSwitcher theme={theme}>
        <Center>
          <HStack>
            <Box width="80%">

    <Stage width={image_size[0] * scale} height={image_size[1] * scale}
      onMouseDown={checkDeselect}
      onMouseMove={(e: any) => {
        if (!(adding === null)) {
          const pointer = e.target.getStage().getPointerPosition()
          setAdding([adding[0], adding[1], pointer.x, pointer.y])
        }
      }}
      onMouseLeave={(e: any) => {
        setAdding(null)
      }}
      onMouseUp={(e: any) => {
        if (!(adding === null)) {
          const rects = rectangles.slice();
          const new_id = Date.now().toString()
          rects.push({
            x: adding[0] / scale,
            y: adding[1] / scale,
            width: (adding[2] - adding[0]) / scale,
            height: (adding[3] - adding[1]) / scale,
            label: label,
            stroke: color_map[label],
            id: new_id
          })
          setRectangles(rects);
          setSelectedId(new_id);
          setAdding(null)
        }
      }}
        ref={stageRef}>
      <Layer>
        <Image image={image} scaleX={scale} scaleY={scale} />
      </Layer>
      <Layer>
        {rectangles.map((rect, i) => {
          return (
            <BBox
              key={i}
              rectProps={rect}
              scale={scale}
              strokeWidth={line_width}
              isSelected={mode === 'Transform' && rect.id === selectedId}
              onClick={() => {
                if (mode === 'Transform') {
                  setSelectedId(rect.id);
                  const rects = rectangles.slice();
                  const lastIndex = rects.length - 1;
                  const lastItem = rects[lastIndex];
                  rects[lastIndex] = rects[i];
                  rects[i] = lastItem;
                  setRectangles(rects);
                  setLabel(rect.label)
                } else if (mode === 'Delete') {
                  const rects = rectangles.slice();
                  setRectangles(rects.filter((element) => element.id !== rect.id));
                }
              }}
              onChange={(newAttrs: any) => {
                const rects = rectangles.slice();
                rects[i] = newAttrs;
                setRectangles(rects);
              }}
            />
          );
        })}
        {adding !== null && <Rect fill={color_map[label] + '4D'} x={adding[0]} y={adding[1]} width={adding[2] - adding[0]} height={adding[3] - adding[1]} />}
      </Layer>
      </Stage>
            </Box>
            <Spacer />
            <Box>
                <VStack>
              <Text fontSize='sm'>Mode</Text>
              <Select value={mode} onChange={(e) => { setMode(e.target.value) }}>
                {['Transform', 'Delete'].map(
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
              <Button onClick={async (e) => {
                let imgBlob = null
                let imgJson  = {}
                try{
                    if (stageRef.current) {
                        imgBlob = await stageRef.current.toBlob()

                        console.log(imgBlob); // This will log the data URI of the stage
                        imgJson = await imageBlobToJson(imgBlob, save_name)
                        console.log(imgJson); // This will log the data URI of the stage

                        }
                }catch{
                    console.error("issue with getting img blob")
                }
                const currentBboxValue = rectangles.map((rect, i) => {
                  return {
                    bbox: [rect.x, rect.y, rect.width, rect.height],
                    label_id: label_list.indexOf(rect.label),
                    label: rect.label,
                  }
                })
                Streamlit.setComponentValue({currentBboxValue, imgJson})
              }}>Complete</Button>
              </VStack>
            </Box>
          </HStack>
        </Center>
      </ThemeSwitcher>
    </ChakraProvider>
  )

}


export default withStreamlitConnection(Detection)
