import React from 'react';
import slugid from 'slugid';
import ReactDOM from 'react-dom';
import {MultiTrackContainer} from './MultiTrackContainer.jsx';

export class MultiViewContainer extends React.Component {
    constructor(props) {
        console.log('hi', props);
        super(props);
    }

    componentWillReceiveProps(newProps) {
        console.log('newProps:', newProps);
    }

    shouldComponentUpdate(nextProps, nextState) {
        console.log('oldProps.text:', this.props.viewConfig.text);
        console.log('newProps.text:', nextProps.viewConfig.text);
        if (nextProps.viewConfig.text == this.props.viewConfig.text) {
            console.log('not updating...');
            return false;
        }

        return true;
    }

    render() {
        let divStyle = {float: 'left', width: '100%'};
        return (
            <div style={divStyle} className="MultiViewContainer">
                { this.props.children }

            </div>
        );
    }
}

