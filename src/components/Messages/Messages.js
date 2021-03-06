import React from 'react';
import {connect} from 'react-redux';
import {setUserPosts} from '../../actions';
import {Segment, Comment} from 'semantic-ui-react';

import firebase from '../../firebase';

import MessagesHeader from './MessagesHeader';
import MessagesForm from './MessagesForm';
import Message from './Message';
import Typing from './Typing';
import Skeleton from './Skeleton';

class Messages extends React.Component {
    state = {
        messagesRef: firebase.database().ref('messages'),
        privateMessagesRef: firebase.database().ref('privateMessages'),
        channel: this.props.currentChannel,
        user: this.props.currentUser,
        messages:[],
        messageLoading: true,
        numUniqueUsers:'',
        searchTerm: '',
        searchLoading:false,
        searchResults:[],
        privateChannel: this.props.isPrivateChannel,
        isChannelStarred: false,
        usersRef: firebase.database().ref('users'),
        typingRef: firebase.database().ref('typing'),
        typingUsers : [],
        connectedRef: firebase.database().ref('.info/connected'),
        listeners: [],
    }
    componentDidMount() {
        const {channel, user, listeners} = this.state;
        if(channel && user) {
            this.removeListeners(listeners)
            this.addListeners(channel.id);
            this.addUserStarsListener(channel.id, user.uid);
            if(this.messagesEnd) {
                this.scrollToBottom();
            }
        }
    }

    componentWillUnmount(){
        this.removeListeners(this.state.listeners);
        this.state.connectedRef.off();
    }

    addToListeners = (id, ref, event) => {
        const index = this.state.listeners.findIndex(listener => {
            return listener.id === id && listener.ref === ref && listener.event  === event;
        })
        if(index === -1) {
            const newListener = {id, ref, event};
            this.setState({listeners: this.state.listeners.concat(newListener)});
        }
    }

    componentDidUpdate(prevProps, prevState) {
        // setTimeout(() => this.messageInputRef.focus(), 0);
        if(this.messagesEnd) {
            this.scrollToBottom();
        }
    }

    scrollToBottom = () => {
        this.messagesEnd.scrollIntoView({behavior: 'smooth'});
    }

    removeListeners = listeners => {
        listeners.forEach(listener => {
            listener.ref.child(listener.id).off(listener.event);
        })
    };

    getMessagesRef = () => {
        const {messagesRef, privateMessagesRef, privateChannel} = this.state;
        return privateChannel ? privateMessagesRef : messagesRef;
    }

    addListeners = channelId => {
        this.addMessageListener(channelId);
        this.addTypingListeners(channelId);
        
    };

    addTypingListeners = channelId => {
        let typingUsers = [];
        this.state.typingRef
            .child(channelId)
            .on('child_added', snap => {
                if(snap.key !== this.state.user.uid) {
                    typingUsers = typingUsers.concat({
                        id: snap.key,
                        name: snap.val()
                    })
                    this.setState({typingUsers});
                }
            })
        this.addToListeners(channelId, this.state.typingRef, 'child_added');
        this.state.typingRef
            .child(channelId)
            .on('child_removed', snap => {
                const index = typingUsers.findIndex(user => user.id === snap.key);
                if(index !== -1) {
                    typingUsers = typingUsers.filter(user => user.id !== snap.key);
                    this.setState({typingUsers});
                }
                if(snap.key !== this.state.user.uid) {
                    typingUsers = typingUsers.concat({
                        id: snap.key,
                        name: snap.val()
                    })
                    this.setState({typingUsers});
                }
            })
        this.addToListeners(channelId, this.state.typingRef, 'child_removed');
        this.state.connectedRef
            .on("value", snap => {
                if(snap.val() === true) {
                    this.state.typingRef
                        .child(channelId)
                        .child(this.state.user.uid)
                        .onDisconnect()
                        .remove(err => {
                            console.log(err);
                        })
                }
            })
        

    }

    addMessageListener = channelId => {
        let loadedMessages = [];
        const ref = this.getMessagesRef();
        ref.child(channelId).on('child_added', snap=>{
            loadedMessages.push(snap.val());
            this.setState({messages:loadedMessages, 'messageLoading':false} );
            this.countUniqueUsers(loadedMessages);
            this.countUserPosts(loadedMessages);
        });
        this.addToListeners(channelId, ref, 'child_added');
    };

    addUserStarsListener = (channelId, userId) => {
        this.state.usersRef
            .child(userId)
            .child("starred")
            .once('value')
            .then(data=>{
                if(data.val() !== null) {
                    const channelIds = Object.keys(data.val());
                    const prevStarred  =channelIds.includes(channelId);
                    this.setState({isChannelStarred : prevStarred});
                }
            });
    }

    countUniqueUsers = messages => {
        const uniqueUsers = messages.reduce((acc, message)=>{
            if(!acc.includes(message.user.name)){
                acc.push(message.user.name);
            }
            return acc;
        },[]);
        const numUniqueUsers = `${uniqueUsers.length} users`;
        this.setState({numUniqueUsers: numUniqueUsers});
    }

    countUserPosts = messages => {
        let userPosts = messages.reduce((acc, message) => {
            if(message.user.name in acc) {
                acc[message.user.name].count += 1;
            }else {
                acc[message.user.name] = {
                    avatar:message.user.avatar,
                    count:1
                }
            }
            return acc;
        }, {});
        this.props.setUserPosts(userPosts);
    }

    displayMessages = messages => (
        messages.length > 0 && messages.map(message => (
            <Message 
                key={message.timestamp}
                message={message}
                user = {this.state.user}
                
            />
        ))
    )

    displayChannelName = channel => {
        return channel?`${this.state.privateChannel? '@':'#'}${channel.name}`:'';

    };

    displayTypingUsers = users => (
        users && users.map( user => (
        <div style={{display: 'flex', alignItems: 'center', marginBottom: '0.2em'}} key={user.id}>
            <span className="user__typing">{user.name} is typing</span> <Typing />
        </div>
        ))
    )

    displayMessagesSkelton = loading => (
        loading ? (
            <React.Fragment>
                {[...Array(10)].map((_,i) => (
                    <Skeleton key={i}/>
                ))}
            </React.Fragment>
        ):null
    )
    handleSearchChange = event => {
        this.setState({
            searchTerm: event.target.value,
            searchLoading: true
        },
        ()=> {this.handleSearchMessages()})
    }
    handleSearchMessages = () => {
        const channelMessages = [...this.state.messages];
        const regex = new RegExp(this.state.searchTerm, 'gi');
        const searchResults = channelMessages.reduce((acc, message)=>{
            // eslint-disable-next-line
            if(message.content && message.content.match(regex) || message.user.name.match(regex)){
                acc.push(message);
            }
            return acc;
        },[]);
        this.setState({searchResults});
        setTimeout(()=>{this.setState({searchLoading: false});}, 1000);
    }
    handleStar = () => {
        this.setState(prevState => ({
            isChannelStarred: !prevState.isChannelStarred
        }), 
        () => this.starChannel()
        );
    }

    starChannel = () => {
        if(this.state.isChannelStarred){
            this.state.usersRef
                .child(`${this.state.user.uid}/starred`)
                .update({
                    [this.state.channel.id]: {
                        name: this.state.channel.name,
                        details: this.state.channel.details,
                        createdBy:{
                            name: this.state.channel.createdBy.name,
                            avatar: this.state.channel.createdBy.avatar,
                        }
                    }
                })

        }else {
            this.state.usersRef
                .child(`${this.state.user.uid}/starred`)
                .child(this.state.channel.id)
                .remove(err => { console.log(err)})
                
        }
    }
    render(){
        const {
            messagesRef, 
            messages, 
            channel, 
            user, 
            numUniqueUsers, 
            searchTerm, 
            searchResults, 
            searchLoading, 
            privateChannel,
            isChannelStarred,
            typingUsers,
            messageLoading
        } = this.state;
        return(
            <React.Fragment>
                <MessagesHeader 
                    channelName = {this.displayChannelName(channel)}
                    numUniqueUsers = {numUniqueUsers}
                    handleSearchChange = {this.handleSearchChange}
                    searchLoading = {searchLoading}
                    privateChannel = {privateChannel}
                    handleStar={this.handleStar}
                    isChannelStarred = {isChannelStarred}
                />
                <Segment>
                    <Comment.Group className='messages'>
                        {this.displayMessagesSkelton(messageLoading)}
                        {searchTerm 
                        ? this.displayMessages(searchResults)
                        : this.displayMessages(messages)}
                        {this.displayTypingUsers(typingUsers)}
                        <div ref={node => (this.messagesEnd = node)}></div>
                    </Comment.Group> 
                </Segment>
                <MessagesForm 
                    messagesRef={messagesRef}
                    currentChannel = {channel}
                    currentUser = {user}
                    privateChannel = {privateChannel}
                    getMessagesRef = {this.getMessagesRef}
                />
            </React.Fragment>
        );
    }
}

export default connect(null, {setUserPosts})(Messages);