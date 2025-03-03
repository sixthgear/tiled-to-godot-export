import { getResPath, getTilesetColumns } from './utils.mjs';

/*global tiled, TextFile */
class GodotTilesetExporter {

    // noinspection DuplicatedCode
    /**
     * Constructs a new instance of the tileset exporter
     * @param {Tileset} tileset the tileset to export
     * @param {string} fileName path of the file the tileset should be exported to
     */
    constructor(tileset, fileName) {
        this.tileset = tileset;
        this.fileName = fileName;
        // noinspection JSUnresolvedFunction
        this.spriteImagePath = getResPath(this.tileset.property("projectRoot"), this.tileset.property("relativePath"), this.tileset.image);
        this.shapesResources = "";
        this.shapes = "";
        this.navpolyMap = [];
        this.zIndexMap = [];
        this.firstShapeID = "0";
    };

    write() {
        this.iterateTiles();
        this.writeToFile();
        tiled.log(`Tileset exported successfully to ${this.fileName}`);
    }

    writeToFile() {
        // noinspection JSUnresolvedVariable
        const file = new TextFile(this.fileName, TextFile.WriteOnly);
        let tilesetTemplate = this.getTilesetTemplate();
        file.write(tilesetTemplate);
        file.commit();
    }

    iterateTiles() {

        let autotileCoordinates = { x: 0, y: 0 };

        // noinspection JSUnresolvedVariable
        let tiles = this.tileset.tiles;

        let minNavId = tiles.reduce((id, tile) => {
            return Math.max(id, tile.id)
        }, 0);

        for (let index = 0; index < tiles.length; index++) {

            let tile = tiles[index];

            const tilesetColumns = getTilesetColumns(this.tileset);
            if ((autotileCoordinates.x + 1) > tilesetColumns) {
                autotileCoordinates.x = 0;
                autotileCoordinates.y += 1;
            }

            const zIndex = tile.property('godot:z_index');
            if (zIndex !== undefined) {
                const zIndexFloat = parseFloat(zIndex);
                if (isNaN(zIndexFloat)) tiled.warn(`Skipping export of godot:z_index on tile with id ${tile.id} because it can not be converted to float. value: ${zIndex}`);
                else this.zIndexMap.push([autotileCoordinates.x, autotileCoordinates.y, zIndexFloat]);
            }

            // noinspection JSUnresolvedVariable
            if (tile.objectGroup !== null) {

                // noinspection JSUnresolvedVariable
                let tileObjects = tile.objectGroup.objects;

                // noinspection JSUnresolvedVariable
                if (tileObjects.length > 0) {
                    // noinspection JSUnresolvedVariable
                    for (let oIndex = 0; oIndex < tileObjects.length; oIndex++) {

                        // noinspection JSUnresolvedVariable
                        let object = tileObjects[oIndex];

                        //TODO: add occlusions
                        if (object.type === "navigation") {
                            minNavId++;
                            this.exportNavigations(object, minNavId, autotileCoordinates);
                        } else {
                            this.exportCollisions(object, tile, autotileCoordinates);
                        }
                    }
                }
            }

            autotileCoordinates.x += 1;
        }

        this.shapes = this.shapes.replace(/,\s*$/, "");
    }

    /**
     * Exports the collision shape for an object
     * @param {MapObject} object the object to export collision shape from
     * @param {Tile} tile the tile the object is part of
     * @param {point} autotileCoordinates autotile coordinates for the tile
     */
    exportCollisions(object, tile, autotileCoordinates) {
        var isOneWay = object.type === "one-way";
        // noinspection JSUnresolvedVariable
        if (object.polygon.length > 0) {
            this.shapesResources += this.getCollisionShapePolygon(tile.id, object);
            this.exportShapes(tile, autotileCoordinates, isOneWay);
        } else if (object.width > 0 && object.height > 0) {
            this.shapesResources += this.getCollisionShapeRectangle(tile.id, object);
            this.exportShapes(tile, autotileCoordinates, isOneWay);
        }
    }

    /**
     * Exports the navigation shapes for an object
     * @param {MapObject} object the object to export navigation shapes from
     * @param {number} id the navigation shape id
     * @param {point} autotileCoordinates autotile coordinates for the tile
     */
    exportNavigations(object, id, autotileCoordinates) {
        if (object.polygon.length > 0) {
            this.shapesResources += this.getNavigationShapePolygon(id, object);
            this.exportNavigationShape(id, autotileCoordinates);
        } else if (object.width > 0 && object.height > 0) {
            this.shapesResources += this.getNavigationShapeRectangle(id, object);
            this.exportNavigationShape(id, autotileCoordinates);
        }
    }

    /**
     * Exports the shape resources for a tile
     * @param {Tile} tile the target tile
     * @param {point} autotileCoordinates autotile coordinates for the tile
     */
    exportShapes(tile, autotileCoordinates, isOneWay) {
        if (this.firstShapeID === "") {
            this.firstShapeID = 'SubResource( ' + tile.id + ' )';
        }
        this.shapes += this.getShapesTemplate(
            autotileCoordinates,
            isOneWay,
            tile.id
        );
    }

    /**
     * Export a single navigation shape
     * @param {number} id id of the shape
     * @param {point} autotileCoordinates autotile coordinates for the tile
     */
    exportNavigationShape(id, autotileCoordinates) {
        this.navpolyMap.push(`Vector2( ${autotileCoordinates.x}, ${autotileCoordinates.y} )`)
        this.navpolyMap.push(`SubResource( ${id} )`)
    }

    getTilesetTemplate() {
        // noinspection JSUnresolvedVariable
        return `[gd_resource type="TileSet" load_steps=3 format=2]

[ext_resource path="res://${this.spriteImagePath}" type="Texture" id=1]

${this.shapesResources}[resource]
0/name = "${this.tileset.name} 0"
0/texture = ExtResource( 1 )
0/tex_offset = Vector2( 0, 0 )
0/modulate = Color( 1, 1, 1, 1 )
0/region = Rect2( ${this.tileset.margin}, ${this.tileset.margin}, ${this.tileset.imageWidth - this.tileset.margin}, ${this.tileset.imageHeight - this.tileset.margin} )
0/tile_mode = 2
0/autotile/icon_coordinate = Vector2( 0, 0 )
0/autotile/tile_size = Vector2( ${this.tileset.tileWidth}, ${this.tileset.tileHeight} )
0/autotile/spacing = ${this.tileset.tileSpacing}
0/autotile/occluder_map = [  ]
0/autotile/navpoly_map = [ ${this.navpolyMap.join(', ')} ]
0/autotile/priority_map = [  ]
0/autotile/z_index_map = [ ${this.zIndexMap.map(item => `Vector3( ${item.join(', ')} )`).join(', ')} ]
0/occluder_offset = Vector2( 0, 0 )
0/navigation_offset = Vector2( 0, 0 )
0/shape_offset = Vector2( 0, 0 )
0/shape_transform = Transform2D( 1, 0, 0, 1, 0, 0 )
0/shape = ${this.firstShapeID}
0/shape_one_way = false
0/shape_one_way_margin = 1.0
0/shapes = [ ${this.shapes} ]
0/z_index = 0
`;
    }

    getShapesTemplate(coordinates, isOneWay, shapeID) {
        let coordinateString = coordinates.x + ", " + coordinates.y;
        return `{
"autotile_coord": Vector2( ${coordinateString} ),
"one_way": ${isOneWay},
"one_way_margin": 1.0,
"shape": SubResource( ${shapeID} ),
"shape_transform": Transform2D( 1, 0, 0, 1, 0, 0 )
}, `;
    }

    getCollisionShapePolygon(id, object) {
        let coordinateString = "";
        // noinspection JSUnresolvedVariable
        object.polygon.forEach((coordinate) => {
            let coordinateX = (object.x + coordinate.x);
            let coordinateY = (object.y + coordinate.y);
            coordinateString += coordinateX + ", " + coordinateY + ", ";
        });
        // Remove trailing commas and blank
        coordinateString = coordinateString.replace(/,\s*$/, "");
        return `[sub_resource type="ConvexPolygonShape2D" id=${id}]
points = PoolVector2Array( ${coordinateString} )

`;
    }

    getCollisionShapeRectangle(id, object) {
        const topLeft = { x: object.x, y: object.y };
        const topRight = { x: (object.x + object.width), y: object.y };
        const bottomRight = { x: (object.x + object.width), y: (object.y + object.height) };
        const bottomLeft = { x: object.x, y: (object.y + object.height) };

        return `[sub_resource type="ConvexPolygonShape2D" id=${id}]
points = PoolVector2Array( ${topLeft.x}, ${topLeft.y}, ${topRight.x}, ${topRight.y}, ${bottomRight.x}, ${bottomRight.y}, ${bottomLeft.x}, ${bottomLeft.y} )

`;
    }

    getNavigationShapePolygon(id, object) {
        let coordinateString = "";
        // noinspection JSUnresolvedVariable
        object.polygon.forEach((coordinate) => {
          let coordinateX = object.x + coordinate.x;
          let coordinateY = object.y + coordinate.y;
          coordinateString += coordinateX + ", " + coordinateY + ", ";
        });
        // Remove trailing commas and blank
        coordinateString = coordinateString.replace(/,\s*$/, "");
        return `[sub_resource type="NavigationPolygon" id=${id}]
vertices = PoolVector2Array( ${coordinateString} )
polygons = [ PoolIntArray ( ${object.polygon.map((_value, index) => index).join(', ')} ) ]

`;
      }

    getNavigationShapeRectangle(id, object) {
        const topLeft = { x: object.x, y: object.y };
        const topRight = { x: object.x + object.width, y: object.y };
        const bottomRight = {
          x: object.x + object.width,
          y: object.y + object.height,
        };
        const bottomLeft = { x: object.x, y: object.y + object.height };

        return `[sub_resource type="NavigationPolygon" id=${id}]
vertices = PoolVector2Array( ${topLeft.x}, ${topLeft.y}, ${topRight.x}, ${topRight.y}, ${bottomRight.x}, ${bottomRight.y}, ${bottomLeft.x}, ${bottomLeft.y} )
polygons = [ PoolIntArray( 0, 1, 2, 3 ) ]

`;
    }

}

const customTilesetFormat = {
    name: "Godot Tileset format",
    extension: "tres",

    /**
     * Tileset exporter function
     * @param {Tileset} tileset the tileset to export
     * @param {string} fileName path of the file where to export the tileset
     * @returns {undefined}
     */
    write: function (tileset, fileName) {
        const exporter = new GodotTilesetExporter(tileset, fileName);
        exporter.write();
        return undefined;
    }
};

// noinspection JSUnresolvedFunction
tiled.registerTilesetFormat("Godot", customTilesetFormat);
