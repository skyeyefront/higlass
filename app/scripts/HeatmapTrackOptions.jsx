import React from 'react';

export class HeatmapTrackOptions extends React.Component {
    constructor(props) {
        super(props);

        this.height = 10;
        this.width = 10;
    }

    render() {
        let divStyle = {
                         position: "absolute",
                         right: "5px",
                         top: "5px",
                         width: this.width,
                         height: this.height
                       }
        return(
            <div 
                style={divStyle} 
            >
                <img 
                    height={this.height}
                    src="images/cross.svg" 
                    width={this.width}
                />
            </div>
            );
    }
}
