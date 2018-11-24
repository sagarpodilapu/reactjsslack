import React from 'react';
import uuidv4 from 'uuid/v4';
import {Segment, Input, Button} from 'semantic-ui-react';
import firebase from '../../firebase';
import FileModal from './FileModal';
import ProgressBar from './ProgressBar';

class MessagesForm extends React.Component {
    state = {
        message: '',
        channel: this.props.currentChannel,
        loading: false,
        user: this.props.currentUser,
        errors:[],
        modal: false,
        uploadState: '',
        uploadTask :null,
        storageRef: firebase.storage().ref(),
        percentUploaded: 0
    }
    openModal = () => this.setState({modal: true});

    closeModal = () => this.setState({modal: false});

    handleChange = event => {
        this.setState({[event.target.name]: event.target.value})
    }

    createMessage = (fileUrl = null) => {
        const message = {
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            user: {
                id: this.state.user.uid,
                name: this.state.user.displayName,
                avatar: this.state.user.photoURL
            }
        };
        if(fileUrl !== null) {
            message['image'] = fileUrl;
        }else {
            message['content'] = this.state.message;
        }
        return message;
    }

    sendMessage = () => {
        const {getMessagesRef} = this.props;
        const {message, channel} = this.state;
        if(message) {
            this.setState({loading: true});
            getMessagesRef()
                .child(channel.id)
                .push()
                .set(this.createMessage())
                .then(()=>{
                    this.setState({loading: false, message:'', errors:[]})
                })
                .catch(err=>{
                    this.setState({errors: this.state.errors.contact(err), loading:false})
                })
        }else {
            this.setState({
                errros: this.state.errors.contact({message: 'Add a message'})
            })
        }

    }

    getPath = () => {
        if(this.props.privateChannel) {
            return `chat/private-${this.state.channel.id}`;
        }else {
            return 'chat/public';
        }
    }

    uploadFile = (file, metadata) => {
        const pathToUpload = this.state.channel.id;
        const ref = this.props.getMessagesRef();
        const filePath = `${this.getPath()}/${uuidv4()}.jpg`;

        this.setState({
            uploadState: 'uploading',
            uploadTask: this.state.storageRef.child(filePath).put(file, metadata)
        },
            () => {
                this.state.uploadTask.on('state_changed', snap => {
                    const percentUploaded = Math.round((snap.bytesTransferred/snap.totalBytes) * 100);
                    this.setState({percentUploaded:percentUploaded})
                },
                err => {
                    console.log(err);
                    this.setState({
                        errors: this.state.errors.concate(err),
                        uploadState:'failed',
                        uploadTask: null
                    });
                },
                () => {
                    this.state.uploadTask.snapshot.ref.getDownloadURL().then(downloadUrl => {
                        this.sendFileMessage(downloadUrl, ref, pathToUpload);
                    })
                    .catch(err => {
                        console.log(err);
                        this.setState({
                            errors: this.state.errors.concate(err),
                            uploadState:'failed',
                            uploadTask: null
                        });
                    })
                })
            }
        );
    }

    sendFileMessage = (fileUrl, ref, pathToUpload) => {
        ref.child(pathToUpload)
        .push()
        .set(this.createMessage(fileUrl))
        .then(() => {
            this.setState({uploadState: 'done'})
        })
        .catch(err => {
            console.log(err);
            this.setState({
                errors: this.state.errors.concat(err),
                uploadState: 'failed',
                uploadTask: null
            });
        })
    }
    render(){
        const {message, loading, modal, uploadState, percentUploaded} = this.state;
        return(
            <Segment className="message__form">
            <Input 
                fluid
                name="message"
                style={{marginBottom: '0.7em'}}
                label={<Button icon={'add'}/>}
                labelPosition="left"
                placeholder="Write your message"
                onChange = {this.handleChange}
                value={message}
            />
            <Button.Group icon widths="2">
                <Button 
                    color="orange"
                    content="Add Reply"
                    labelPosition="left"
                    icon="edit"
                    onClick = {this.sendMessage}
                    disabled={loading}
                />
                <Button 
                    color="teal"
                    disable={(uploadState === "uploading").toString()}
                    content="Upload Media"
                    labelPosition="right"
                    icon="cloud upload"
                    onClick = {this.openModal}
                />
            </Button.Group>
            <FileModal 
                    modal={modal}
                    closeModal = {this.closeModal}
                    uploadFile = {this.uploadFile}
                />
                <ProgressBar 
                    uploadState = {uploadState}
                    percentUploaded = {percentUploaded}
                />
            </Segment>
        )
    }
}

export default MessagesForm;