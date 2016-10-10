import '../styles/MultiTrackEditContainer.css';
import React from 'react';
import slugid from 'slugid';
import ReactDOM from 'react-dom';

export class MultiTrackEditContainer extends React.Component {
    constructor(props) {
        super(props);

    }

    componentWillReceiveProps(newProps) {
        console.log('newProps:', newProps);
    }

    shouldComponentUpdate(nextProps, nextState) {
        return true;
    }

    render() {
        let searchDivStyle = {};
        let divStyle = { position: 'relative',
                         className: 'big-div',
                         width: this.props.viewConfig.width,
                         height: this.props.viewConfig.height }

        let viewStyle = this.props.viewConfig.viewStyle;

        let imgStyle = { right: 10,
                         bottom: 10,
                         position: 'absolute' }
        let canvasStyle = { top: 0,
                            left: 0,
                            width: '100%',
                            height: this.height }
        let addTrackDivStyle = { position: 'relative'
        };

        let svgStyle = { height: 20,
                         width: '100%'
        }

        let trackList = this.props.viewConfig.tracks;

        //<img src="images/plus.svg" width="20px" style={imgStyle}/>
        /*
                <div style={addTrackDivStyle}>
                    <AddTrackDiv />
                </div>
                */

        return(
            <div style={viewStyle}>
            <div>
                { (() => {
                    if (this.props.viewConfig.searchBox) {
                return <GenomePositionSearchBox 
                    zoomToGenomePositionHandler={this.zoomToGenomePosition.bind(this)}
                    chromInfoPath={this.props.viewConfig.chromInfoPath}
                    zoomDispatch={this.zoomDispatch}
                    xRange={this.state.xRange}
                    yRange={this.state.yRange}
                    xDomain={this.state.xDomain}
                    yDomain={this.state.yDomain}
                    twoD={this.twoD}
                    />
                    }})() }
            </div>
            <div style={divStyle} ref={(c) => this.bigDiv = c} >
                { trackList.map(function(track, i) 
                        {
                            console.log('track.width:', track.width, track);
                            return (
                                <div 
                                                 className={'edit-track'}
                                                 style={{left: track.left, 
                                                         top: track.top, 
                                                         width: track.width,
                                                         height: track.height,
                                                         position: 'absolute'}}
                                                        key={track.uid}
                                                 />
                                
                                                 /*
                                <DraggableDiv 
                                                 width={track.width} 
                                                 height={track.height} 
                                                 top={track.top} 
                                                 left={track.left} 
                                                 sizeChanged={this.trackSizeChanged.bind(this)} 
                                                 trackClosed={this.trackClosed.bind(this)}
                                                 trackRotated={this.trackRotated.bind(this)}
                                                 uid={track.uid}
                                                 opacity={this.trackOpacity(track)}
                                    >
                                    
                                    </DraggableDiv>
                                    */
                                    );

                        }.bind(this)) 
                }
            </div>
                </div>
        );
    }
}

