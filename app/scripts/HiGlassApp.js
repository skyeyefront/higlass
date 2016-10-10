import '../styles/HiGlassApp.css';
import React from 'react';
import ReactDOM from 'react-dom';
import slugid from 'slugid';
import {MultiViewContainer} from './MultiViewContainer.jsx';
import {MultiViewEditContainer} from './MultiViewEditContainer.jsx';
import {MultiTrackContainer} from './MultiTrackContainer.jsx';
import {MultiTrackEditContainer} from './MultiTrackEditContainer.jsx';
import {HiGlassInput} from './HiGlassInput.jsx';
import {Button, Panel, FormGroup, ControlLabel, FormControl, SafeAnchor} from 'react-bootstrap';

export class HiGlassApp extends React.Component {
    constructor(props) {
        super(props);

    this.defaultViewString = JSON.stringify(JSON.parse(this.props.viewConfigString), null, 2);

    this.state = {
        //viewConfig : []

        viewConfig : { 
            object: JSON.parse(this.props.viewConfigString),
            text: JSON.stringify(JSON.parse(this.props.viewConfigString))
        },
        updateUid: slugid.nice(),
        inputOpen: false
    }

    console.log('this.state:', this.state);
    this.updateLinkedViews(this.state.viewConfig.object);

    }

    updateLinkedViews(viewConfig) {
        console.log('updating linked views:', viewConfig);
        for (let i = 0; i < viewConfig.views.length; i++) {
            if (typeof viewConfig.views[i].zoomLock ==  'undefined')
                viewConfig.views[i].zoomDispatch = d3.dispatch('zoom', 'zoomend')
            else {
                let zoomLock = viewConfig.views[i].zoomLock;
                if (typeof viewConfig.views[zoomLock].zoomDispatch == 'undefined') {
                    console.log('WARNING: view requests zoom lock to another view with an undefined zoomDispatch:', zoomLock);
                    viewConfig.views[i].zoomDispatch = d3.dispatch('zoom', 'zoomend')
                } else {
                    viewConfig.views[i].zoomDispatch = viewConfig.views[zoomLock].zoomDispatch;
                }
            }
        }

    }

    handleNewConfig(configText) {
        let viewConfig = JSON.parse(configText);
        this.updateLinkedViews(viewConfig);

        this.setState(
         {
             viewConfig : { 
                 object: viewConfig,
                 text: JSON.stringify(viewConfig)
             }
         });

    };
        
    handleOpen() {
        console.log('handling open...');
        this.setState({
            'inputOpen': !this.state.inputOpen
        });
    }

    handleViewEdit(newViewConfig) {

    }

    dimensionsUpdated(updateUid) {
        //some dimensions were updated in a MultiTrackContainer, that means that we need
        // to update the edit container
        console.log('dimensions updated viewConfig:', updateUid);
        this.setState({ updateUid: updateUid });
    }

    render() {
        /*
        let divStyle = {"paddingLeft": "20px",
                        "paddingRight": "20px"}
        */
       let divStyle = {};

        let toolbarStyle = {"position": "relative",
                       "top": "-1px"};

        return (
                <div style={divStyle}>

                <Panel 
                    ref='displayPanel'
                    className="higlass-display"
                    >
                    <div style={{'position': 'relative'}}>
                    <div style={{}}>
                    <MultiViewContainer viewConfig={this.state.viewConfig} >
                    { 
                        this.state.viewConfig.object.views.map(function(view, i) 
                                         {
                                             return (<MultiTrackContainer
                                                     viewConfig ={view}
                                                     key={slugid.nice()}
                                                     dimensionsUpdated={this.dimensionsUpdated.bind(this)}
                                                     />)
                                         }.bind(this))
                    }
                    </MultiViewContainer>
                    </div>
                    <div style={{'position': 'absolute', 'left': 0, 'top': 0, 
                        'visibility': this.state.inputOpen ? 'visible' : 'hidden'}}>
                    <MultiViewEditContainer viewConfig={this.state.viewConfig}
                    handleEdit={this.handleViewEdit.bind(this)}
                    updateUid={this.state.updateUid}
                    visible={this.state.inputOpen}>
                    { this.state.viewConfig.object.views.map(function(view, i) 
                                         {
                                             return (<MultiTrackEditContainer
                                                     viewConfig ={view}
                                                     key={slugid.nice()}
                                                     updateUid={this.state.updateUid}
                                                     />)
                                         }.bind(this))
                    }

                        </MultiViewEditContainer>
                        </div>
                        </div>

                </Panel>
                { (() => { if (this.state.viewConfig.object.editable) {
                return <HiGlassInput currentConfig={this.defaultViewString} 
                        onNewConfig={this.handleNewConfig.bind(this)} 
                        inputOpen={this.state.inputOpen}
                        handleOpen={this.handleOpen.bind(this)}
                        />
                                                      }})() }
                </div>
        );
    }
}

