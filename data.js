var APP_DATA = {
  "scenes": [
    {
      "id": "0-recibidor",
      "name": "RECIBIDOR",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "yaw": -0.28707095554576334,
        "pitch": 0.5096678943178752,
        "fov": 1.1280412618726754
      },
      "linkHotspots": [
        {
          "yaw": -1.4422247579457927,
          "pitch": 0.41446035330429254,
          "rotation": 0,
          "target": "1-sala"
        },
        {
          "yaw": -0.5758091115308837,
          "pitch": 0.14769453312230496,
          "rotation": 0,
          "target": "2-cocina"
        },
        {
          "yaw": 0.43320963584643124,
          "pitch": 0.21709536199446866,
          "rotation": 0,
          "target": "3-recamara"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "1-sala",
      "name": "SALA",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": 0.022000130696518738,
          "pitch": 0.41437138861411427,
          "rotation": 0,
          "target": "0-recibidor"
        },
        {
          "yaw": -1.5866584544463755,
          "pitch": 0.19694918742906253,
          "rotation": 0,
          "target": "2-cocina"
        },
        {
          "yaw": -0.5591192195451384,
          "pitch": 0.16079559470356308,
          "rotation": 0,
          "target": "3-recamara"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "2-cocina",
      "name": "COCINA",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": -0.0014047617422274783,
          "pitch": 0.18714196689078477,
          "rotation": 0,
          "target": "1-sala"
        },
        {
          "yaw": -0.5708193684762897,
          "pitch": 0.2328144604395792,
          "rotation": 0,
          "target": "0-recibidor"
        }
      ],
      "infoHotspots": []
    },
    {
      "id": "3-recamara",
      "name": "RECAMARA",
      "levels": [
        {
          "tileSize": 256,
          "size": 256,
          "fallbackOnly": true
        },
        {
          "tileSize": 512,
          "size": 512
        },
        {
          "tileSize": 512,
          "size": 1024
        },
        {
          "tileSize": 512,
          "size": 2048
        }
      ],
      "faceSize": 2048,
      "initialViewParameters": {
        "pitch": 0,
        "yaw": 0,
        "fov": 1.5707963267948966
      },
      "linkHotspots": [
        {
          "yaw": -1.9522242591332901,
          "pitch": 0.4080334424758334,
          "rotation": 0,
          "target": "0-recibidor"
        }
      ],
      "infoHotspots": []
    }
  ],
  "name": "TROYA 839",
  "settings": {
    "mouseViewMode": "drag",
    "autorotateEnabled": true,
    "fullscreenButton": true,
    "viewControlButtons": true
  }
};
