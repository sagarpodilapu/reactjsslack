import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import Login from './components/Auth/Login';
import About from './components/About';
import Spinner from './components/Spinner';
import Register from './components/Auth/Register';
import registerServiceWorker from './registerServiceWorker';
import firebase from './firebase';
import { BrowserRouter as Router, Switch, Route, withRouter } from 'react-router-dom';

import 'semantic-ui-css/semantic.min.css';

import {createStore} from 'redux';
import { Provider, connect} from 'react-redux';
import {composeWithDevTools} from 'redux-devtools-extension';
import rootReducer from './reducers';

import {setUser, clearUser} from './actions'; 

const store = createStore(rootReducer,composeWithDevTools());

class Root extends React.Component {
    componentDidMount(){
        firebase.auth().onAuthStateChanged(user => {
            if(user) {
                this.props.setUser(user)
                this.props.history.push('/');
            }else {
                this.props.history.push('/login');
                this.props.clearUser();
            }
        })
    }
    render() {
        return this.props.isLoading ? <Spinner /> : (
            <Switch>
                <Route exact path ='/' component = {App} />
                <Route path ='/login' component = {Login} />
                <Route path ='/Register' component = {Register} />
                <Route path ='/about' component = {About} />
            </Switch>
        )
    }
}
const mapStateFromProps = state => ({
    isLoading: state.user.isLoading
});

const RootWithAuth = withRouter(connect(mapStateFromProps, {setUser, clearUser})(Root));

ReactDOM.render(
    <Provider store={store}>
        <Router>
            <RootWithAuth />
        </Router>
    </Provider>, 
    document.getElementById('root'));
registerServiceWorker();
