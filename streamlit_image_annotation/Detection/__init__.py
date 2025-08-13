import os
import uuid

import requests
import numpy as np
from enum import IntEnum
from io import BytesIO
from PIL import Image, ImageOps
import streamlit as st

import matplotlib.pyplot as plt

import streamlit.components.v1 as components
from streamlit.components.v1.components import CustomComponent
from streamlit.deprecation_util import show_deprecation_warning
from streamlit.errors import StreamlitAPIException

try:
    from streamlit.elements.image import image_to_url
except:
    from streamlit.elements.lib.image_utils import image_to_url
from streamlit_image_annotation import IS_RELEASE

if IS_RELEASE:
    absolute_path = os.path.dirname(os.path.abspath(__file__))
    build_path = os.path.join(absolute_path, "frontend/build")
    _component_func = components.declare_component("st-detection", path=build_path)
else:
    _component_func = components.declare_component("st-detection", url="http://localhost:3000")


def get_colormap(label_names, colormap_name="gist_rainbow"):
    colormap = {}
    cmap = plt.get_cmap(colormap_name)
    for idx, l in enumerate(label_names):
        rgb = [int(d) for d in np.array(cmap(float(idx) / len(label_names))) * 255][:3]
        colormap[l] = "#%02x%02x%02x" % tuple(rgb)
    return colormap


class WidthBehavior(IntEnum):
    """
    Special values that are recognized by the frontend and allow us to change the
    behavior of the displayed image.
    """

    ORIGINAL = -1
    COLUMN = -2
    AUTO = -3
    MIN_IMAGE_OR_CONTAINER = -4
    MAX_IMAGE_OR_CONTAINER = -5


def get_image_size_from_url(image_url):
    """
    Fetches an image from a URL and returns its dimensions (width, height).

    Args:
        image_url (str): The URL of the image.

    Returns:
        tuple: A tuple containing the width and height of the image (width, height),
               or None if an error occurs.
    """
    try:
        response = requests.get(image_url)
        response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)

        image_content = response.content
        image_stream = BytesIO(image_content)
        img = Image.open(image_stream)
        print(f"Raw dimensions: Width={img.size[0]}, Height={img.size[1]}")
        # Apply EXIF transpose to correctly orient the image
        img_transposed = ImageOps.exif_transpose(img)
        print(
            f"Corrected dimensions: Width={img_transposed.size[0]}, Height={img_transposed.size[1]}"
        )

        return img_transposed.size
    except requests.exceptions.RequestException as e:
        print(f"Error fetching image from URL: {e}")
        return None
    except Image.UnidentifiedImageError:
        print(f"Error: Could not identify image from URL: {image_url}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None


#'''
# bboxes:
# [[x,y,w,h],[x,y,w,h]]
# labels:
# [0,3]
#'''


def detection(
    image,
    label_list,
    use_column_width=None,
    clamp=False,
    width=None,
    channels="RGB",
    output_format="auto",
    use_container_width: bool = False,
    bboxes=None,
    labels=None,
    line_width=5.0,
    use_space=False,
    key=None,
) -> CustomComponent:

    if use_container_width is True and use_column_width is not None:
        raise StreamlitAPIException(
            "`use_container_width` and `use_column_width` cannot be set at the same time.",
            "Please utilize `use_container_width` since `use_column_width` is deprecated.",
        )

    image_width: int = WidthBehavior.ORIGINAL if (width is None or width <= 0) else width

    if use_column_width is not None:
        show_deprecation_warning(
            "The `use_column_width` parameter has been deprecated and will be removed "
            "in a future release. Please utilize the `use_container_width` parameter instead."
        )

        if use_column_width == "auto":
            image_width = WidthBehavior.AUTO
        elif use_column_width == "always" or use_column_width is True:
            image_width = WidthBehavior.COLUMN
        elif use_column_width == "never" or use_column_width is False:
            image_width = WidthBehavior.ORIGINAL

    elif use_container_width is True:
        image_width = WidthBehavior.MAX_IMAGE_OR_CONTAINER
    elif image_width is not None and image_width > 0:
        # Use the given width. It will be capped on the frontend if it
        # exceeds the container width.
        pass
    elif use_container_width is False:
        image_width = WidthBehavior.MIN_IMAGE_OR_CONTAINER

    # Generate a Version 4 (random) UUID
    my_uuid = uuid.uuid4()
    # You can also convert it to a string explicitly if needed
    uuid_as_string = str(my_uuid)
    image_path = image_to_url(
        image,
        image_width,
        clamp,
        channels,
        output_format,
        f"detection-{uuid_as_string}-{key}",
    )
    host = st.context.headers.get("origin")
    full_image_url = host + image_path
    color_map = get_colormap(label_list, colormap_name="gist_rainbow")
    bbox_info = [
        {"bbox": [b for b in item[0]], "label_id": item[1], "label": label_list[item[1]]}
        for item in zip(bboxes, labels)
    ]

    component_value = _component_func(
        image_url=full_image_url,
        image_size=get_image_size_from_url(full_image_url),
        label_list=label_list,
        bbox_info=bbox_info,
        color_map=color_map,
        line_width=line_width,
        use_space=use_space,
        # key=key,
    )
    if component_value is not None:
        return component_value


if not IS_RELEASE:
    from glob import glob
    import io

    label_list = ["deer", "human", "dog", "penguin", "framingo", "teddy bear"]
    image_path_list = glob("image/*.jpg")
    if "result_dict" not in st.session_state:
        result_dict = {}
        for img in image_path_list:
            result_dict[img] = {"bboxes": [[0, 0, 100, 100], [10, 20, 50, 150]], "labels": [0, 3]}
        st.session_state["result_dict"] = result_dict.copy()

    num_page = st.slider("page", 0, len(image_path_list) - 1, 0, key="sliderw")
    target_image_path = image_path_list[num_page]
    with open(target_image_path, "rb") as f:
        image_bytes = f.read()
    image_bytes_io = io.BytesIO(image_bytes)
    new_labels = detection(
        target_image_path,
        bboxes=[],
        labels=[],
        label_list=label_list,
        line_width=5,
        use_space=True,
        # key=target_image_path,
    )
    st.write(new_labels)
