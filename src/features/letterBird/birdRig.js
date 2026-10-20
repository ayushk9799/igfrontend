// Skeleton + buffer layout for assets/letter-bird/bird.bin (generated from the rigged glTF).
// layout: name -> [byteOffset, elementCount]. Bones are listed in skin-joint order.
export const BIRD_RIG = {
  "vertexCount": 26612,
  "layout": {
    "position": [
      0,
      79836
    ],
    "normal": [
      319344,
      79836
    ],
    "uv": [
      638688,
      53224
    ],
    "skinIndex": [
      851584,
      106448
    ],
    "skinWeight": [
      958032,
      106448
    ],
    "index": [
      1383824,
      61431
    ],
    "inverseBind": [
      1506688,
      272
    ]
  },
  "bones": [
    {
      "name": "root",
      "parent": -1,
      "t": [
        0.0,
        0.0,
        0.08
      ]
    },
    {
      "name": "hips",
      "parent": 0,
      "t": [
        0.0,
        0.18,
        -0.02
      ]
    },
    {
      "name": "chest",
      "parent": 1,
      "t": [
        0.0,
        0.12,
        0.01
      ]
    },
    {
      "name": "neck",
      "parent": 2,
      "t": [
        0.0,
        0.1,
        0.03
      ]
    },
    {
      "name": "head",
      "parent": 3,
      "t": [
        0.0,
        0.07,
        -0.0
      ]
    },
    {
      "name": "crest",
      "parent": 4,
      "t": [
        0.0,
        0.13,
        -0.08
      ]
    },
    {
      "name": "wing_L",
      "parent": 2,
      "t": [
        0.1,
        0.07,
        -0.02
      ]
    },
    {
      "name": "wingtip_L",
      "parent": 6,
      "t": [
        0.17,
        -0.0,
        -0.04
      ]
    },
    {
      "name": "wing_R",
      "parent": 2,
      "t": [
        -0.1,
        0.07,
        -0.02
      ]
    },
    {
      "name": "wingtip_R",
      "parent": 8,
      "t": [
        -0.17,
        -0.0,
        -0.04
      ]
    },
    {
      "name": "tail",
      "parent": 1,
      "t": [
        0.0,
        0.08,
        -0.15
      ]
    },
    {
      "name": "thigh_L",
      "parent": 1,
      "t": [
        0.057,
        -0.02,
        0.0
      ]
    },
    {
      "name": "shin_L",
      "parent": 11,
      "t": [
        -0.0,
        -0.055,
        0.015
      ]
    },
    {
      "name": "foot_L",
      "parent": 12,
      "t": [
        -0.0,
        -0.07,
        0.005
      ]
    },
    {
      "name": "thigh_R",
      "parent": 1,
      "t": [
        -0.057,
        -0.02,
        0.0
      ]
    },
    {
      "name": "shin_R",
      "parent": 14,
      "t": [
        0.0,
        -0.055,
        0.015
      ]
    },
    {
      "name": "foot_R",
      "parent": 15,
      "t": [
        0.0,
        -0.07,
        0.005
      ]
    }
  ]
};
